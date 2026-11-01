/*
 * Browser port of the PixelFlow simulation used by "Art of Ink".
 *
 * The Processing sketch feeds the painting into a density field, advects it
 * with a velocity field, adds vorticity, then projects the field to keep it
 * incompressible. The constants and update order below intentionally follow
 * project_5.pde and PixelFlow's DwFluid2D implementation.
 */
(function () {
  "use strict";

  const hero = document.querySelector("#view-home .hero");
  const canvas = document.querySelector("#inkFlow");
  const image = hero && hero.querySelector(".ink-range");
  if (!hero || !canvas || !image) return;
  canvas.dataset.fluidState = "initializing";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reducedMotion.matches) {
    canvas.dataset.fluidState = "reduced-motion";
    return;
  }

  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
  });
  if (!gl) {
    canvas.dataset.fluidState = "unsupported";
    return;
  }

  const floatColor = gl.getExtension("EXT_color_buffer_float");
  gl.getExtension("OES_texture_float_linear");
  if (!floatColor) {
    canvas.dataset.fluidState = "unsupported";
    return;
  }

  const vertexSource = `#version 300 es
    in vec2 aPosition;
    out vec2 vUv;
    void main() {
      vUv = aPosition * 0.5 + 0.5;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  const advectSource = `#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 outColor;

    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 uTexel;
    uniform float uDissipation;

    void main() {
      vec2 velocity = texture(uVelocity, vUv).xy;
      vec2 back = vUv - 0.125 * velocity * uTexel;
      outColor = uDissipation * texture(uSource, clamp(back, vec2(0.0), vec2(1.0)));
    }
  `;

  const addDensitySource = `#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 outColor;

    uniform sampler2D uDensity;
    uniform sampler2D uImage;
    uniform vec2 uFluidSize;
    uniform vec2 uImageSize;
    uniform vec2 uObjectPosition;
    uniform float uMix;

    vec2 coverUv(vec2 p) {
      float canvasAspect = uFluidSize.x / uFluidSize.y;
      float imageAspect = uImageSize.x / uImageSize.y;
      vec2 visible = canvasAspect > imageAspect
        ? vec2(1.0, imageAspect / canvasAspect)
        : vec2(canvasAspect / imageAspect, 1.0);
      vec2 offset = (1.0 - visible) * uObjectPosition;
      return clamp(offset + p * visible, vec2(0.001), vec2(0.999));
    }

    void main() {
      vec4 oldValue = texture(uDensity, vUv);
      vec4 imageValue = texture(uImage, coverUv(vUv));
      float amount = uMix * imageValue.a;
      outColor = mix(oldValue, imageValue, amount);
    }
  `;

  const addVelocitySource = `#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 outColor;

    uniform sampler2D uVelocity;
    uniform vec2 uSourceSize;
    uniform vec2 uTargetSize;
    uniform vec2 uPosition;
    uniform float uRadius;
    uniform vec2 uValue;

    void main() {
      vec2 scale = uTargetSize / uSourceSize;
      vec2 center = uPosition * scale;
      float radius = uRadius * (scale.x + scale.y) * 0.5;
      vec2 oldValue = texture(uVelocity, vUv).xy;
      vec4 result = vec4(oldValue, 0.0, 1.0);
      float dist = distance(center, gl_FragCoord.xy);
      if (dist < radius) {
        float distNorm = 1.0 - clamp(dist / radius, 0.0, 1.0);
        vec2 newValue = uValue * distNorm;
        if (length(oldValue) <= length(newValue)) {
          result.xy = mix(oldValue, newValue, 0.5);
        }
      }
      outColor = result;
    }
  `;

  const addTemperatureSource = `#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 outColor;

    uniform sampler2D uTemperature;
    uniform vec2 uSourceSize;
    uniform vec2 uTargetSize;
    uniform vec2 uPosition;
    uniform float uRadius;

    void main() {
      vec2 scale = uTargetSize / uSourceSize;
      vec2 center = uPosition * scale;
      float radius = uRadius * (scale.x + scale.y) * 0.5;
      float oldValue = texture(uTemperature, vUv).x;
      outColor = vec4(oldValue, 0.0, 0.0, 1.0);
      if (distance(center, gl_FragCoord.xy) < radius) {
        outColor.x = 15.0;
      }
    }
  `;

  const buoyancySource = `#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 outColor;

    uniform sampler2D uVelocity;
    uniform sampler2D uTemperature;
    uniform sampler2D uDensity;

    void main() {
      vec2 velocity = texture(uVelocity, vUv).xy;
      float temperature = texture(uTemperature, vUv).x;
      if (temperature != 0.0) {
        float density = texture(uDensity, vUv).a;
        float force = 0.125 * temperature - density * 0.001;
        velocity += vec2(0.0, 1.0) * force;
      }
      outColor = vec4(velocity, 0.0, 1.0);
    }
  `;

  const curlSource = `#version 300 es
    precision highp float;
    out vec4 outColor;

    uniform sampler2D uVelocity;
    uniform ivec2 uSize;

    vec2 velocityAt(ivec2 p) {
      return texelFetch(uVelocity, clamp(p, ivec2(0), uSize - 1), 0).xy;
    }

    void main() {
      ivec2 p = ivec2(gl_FragCoord.xy);
      vec2 top = velocityAt(p + ivec2(0, 1));
      vec2 bottom = velocityAt(p - ivec2(0, 1));
      vec2 right = velocityAt(p + ivec2(1, 0));
      vec2 left = velocityAt(p - ivec2(1, 0));
      float value = 0.5 * ((top.x - bottom.x) - (right.y - left.y));
      outColor = vec4(value, 0.0, 0.0, 1.0);
    }
  `;

  const vorticitySource = `#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 outColor;

    uniform sampler2D uVelocity;
    uniform sampler2D uCurl;
    uniform ivec2 uSize;

    float curlAt(ivec2 p) {
      return texelFetch(uCurl, clamp(p, ivec2(0), uSize - 1), 0).x;
    }

    void main() {
      ivec2 p = ivec2(gl_FragCoord.xy);
      vec2 velocity = texture(uVelocity, vUv).xy;
      float top = abs(curlAt(p + ivec2(0, 1)));
      float bottom = abs(curlAt(p - ivec2(0, 1)));
      float right = abs(curlAt(p + ivec2(1, 0)));
      float left = abs(curlAt(p - ivec2(1, 0)));
      float center = curlAt(p);
      vec2 direction = normalize(0.5 * vec2(top - bottom, right - left) + 0.000001);
      direction *= vec2(-1.0, 1.0);
      vec2 force = direction * center * 0.125 * 0.5;
      outColor = vec4(velocity + force, 0.0, 1.0);
    }
  `;

  const divergenceSource = `#version 300 es
    precision highp float;
    out vec4 outColor;

    uniform sampler2D uVelocity;
    uniform ivec2 uSize;

    vec2 velocityAt(ivec2 p) {
      return texelFetch(uVelocity, clamp(p, ivec2(0), uSize - 1), 0).xy;
    }

    void main() {
      ivec2 p = ivec2(gl_FragCoord.xy);
      vec2 top = velocityAt(p + ivec2(0, 1));
      vec2 bottom = velocityAt(p - ivec2(0, 1));
      vec2 right = velocityAt(p + ivec2(1, 0));
      vec2 left = velocityAt(p - ivec2(1, 0));
      float value = 0.5 * ((right.x - left.x) + (top.y - bottom.y));
      outColor = vec4(value, 0.0, 0.0, 1.0);
    }
  `;

  const jacobiSource = `#version 300 es
    precision highp float;
    out vec4 outColor;

    uniform sampler2D uPressure;
    uniform sampler2D uDivergence;
    uniform ivec2 uSize;

    float pressureAt(ivec2 p) {
      return texelFetch(uPressure, clamp(p, ivec2(0), uSize - 1), 0).x;
    }

    void main() {
      ivec2 p = ivec2(gl_FragCoord.xy);
      float pressure =
        pressureAt(p - ivec2(1, 0)) +
        pressureAt(p + ivec2(1, 0)) +
        pressureAt(p - ivec2(0, 1)) +
        pressureAt(p + ivec2(0, 1));
      float divergence = texelFetch(uDivergence, p, 0).x;
      outColor = vec4((pressure - divergence) * 0.25, 0.0, 0.0, 1.0);
    }
  `;

  const gradientSource = `#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 outColor;

    uniform sampler2D uVelocity;
    uniform sampler2D uPressure;
    uniform ivec2 uSize;

    float pressureAt(ivec2 p) {
      return texelFetch(uPressure, clamp(p, ivec2(0), uSize - 1), 0).x;
    }

    void main() {
      ivec2 p = ivec2(gl_FragCoord.xy);
      vec2 gradient = vec2(
        pressureAt(p + ivec2(1, 0)) - pressureAt(p - ivec2(1, 0)),
        pressureAt(p + ivec2(0, 1)) - pressureAt(p - ivec2(0, 1))
      );
      vec2 velocity = texture(uVelocity, vUv).xy;
      outColor = vec4(velocity - gradient, 0.0, 1.0);
    }
  `;

  const displaySource = `#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 outColor;

    uniform sampler2D uDensity;

    void main() {
      vec4 density = texture(uDensity, vUv);
      density.a = clamp(density.a, 0.0, 1.0);
      vec3 color = density.a > 0.00001
        ? clamp(density.rgb / density.a, 0.0, 1.0)
        : vec3(1.0);
      outColor = vec4(color, density.a);
    }
  `;

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn("Art of Ink shader:", gl.getShaderInfoLog(shader));
      canvas.dataset.fluidState = "shader-error";
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(fragmentSource) {
    const vertex = compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragment = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return null;
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, "aPosition");
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("Art of Ink program:", gl.getProgramInfoLog(program));
      canvas.dataset.fluidState = "shader-error";
      gl.deleteProgram(program);
      return null;
    }
    const uniforms = Object.create(null);
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let index = 0; index < count; index++) {
      const info = gl.getActiveUniform(program, index);
      const location = gl.getUniformLocation(program, info.name);
      uniforms[info.name] = location;
    }
    return { program, uniforms };
  }

  const programs = {
    advect: createProgram(advectSource),
    addDensity: createProgram(addDensitySource),
    addVelocity: createProgram(addVelocitySource),
    addTemperature: createProgram(addTemperatureSource),
    buoyancy: createProgram(buoyancySource),
    curl: createProgram(curlSource),
    vorticity: createProgram(vorticitySource),
    divergence: createProgram(divergenceSource),
    jacobi: createProgram(jacobiSource),
    gradient: createProgram(gradientSource),
    display: createProgram(displaySource),
  };
  if (Object.values(programs).some(program => !program)) return;

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  function createTexture(width, height, internalFormat, format, type, filter) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      internalFormat,
      width,
      height,
      0,
      format,
      type,
      null,
    );
    return texture;
  }

  function createTarget(width, height, internalFormat, format) {
    const texture = createTexture(
      width,
      height,
      internalFormat,
      format,
      gl.HALF_FLOAT,
      gl.LINEAR,
    );
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );
    const complete =
      gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!complete) {
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(texture);
      return null;
    }
    return { texture, framebuffer, width, height };
  }

  function createPair(width, height, internalFormat, format) {
    const a = createTarget(width, height, internalFormat, format);
    const b = createTarget(width, height, internalFormat, format);
    if (!a || !b) {
      disposeTarget(a);
      disposeTarget(b);
      return null;
    }
    return { a, b };
  }

  function disposeTarget(target) {
    if (!target) return;
    gl.deleteFramebuffer(target.framebuffer);
    gl.deleteTexture(target.texture);
  }

  function disposePair(pair) {
    if (!pair) return;
    disposeTarget(pair.a);
    disposeTarget(pair.b);
  }

  function clearTarget(target) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.viewport(0, 0, target.width, target.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  function bindTexture(unit, texture) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
  }

  function useProgram(program, target) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.framebuffer : null);
    if (target) {
      gl.viewport(0, 0, target.width, target.height);
    } else {
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    gl.useProgram(program.program);
    gl.bindVertexArray(vao);
  }

  function draw() {
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  const imageTexture = createTexture(
    1,
    1,
    gl.RGBA8,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    gl.LINEAR,
  );

  const pointer = {
    active: false,
    right: false,
    x: 0,
    y: 0,
    previousX: 0,
    previousY: 0,
    viewWidth: 1,
    viewHeight: 1,
  };

  let velocity = null;
  let density = null;
  let temperature = null;
  let pressure = null;
  let divergence = null;
  let curl = null;
  let fluidWidth = 0;
  let fluidHeight = 0;
  let gridScale = 1;
  let simulationStep = 0;
  let objectPosition = [0.18, 1.0];
  let imageReady = false;
  let running = false;
  let paused = false;
  let heroVisible = true;
  let frameCount = 0;
  let animationFrame = 0;
  let ambientNext = 0;
  let lastHoverInk = 0;

  function releaseSimulation() {
    disposePair(velocity);
    disposePair(density);
    disposePair(temperature);
    disposePair(pressure);
    disposeTarget(divergence);
    disposeTarget(curl);
    velocity = null;
    density = null;
    temperature = null;
    pressure = null;
    divergence = null;
    curl = null;
  }

  function updateImagePlacement() {
    if (window.innerWidth <= 700) objectPosition = [0.37, 1.0];
    else if (window.innerWidth <= 1180) objectPosition = [0.22, 1.0];
    else objectPosition = [0.18, 1.0];
  }

  function resizeSimulation() {
    if (!imageReady) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointer.viewWidth = rect.width;
    pointer.viewHeight = rect.height;
    updateImagePlacement();

    const area = rect.width * rect.height;
    const automaticScale = area > 2400000 ? 2 : 1;
    const scale = Math.max(1, automaticScale, gridScale);
    const width = Math.max(2, Math.ceil(rect.width / scale));
    const height = Math.max(2, Math.ceil(rect.height / scale));
    if (width === fluidWidth && height === fluidHeight && velocity) return;

    releaseSimulation();
    fluidWidth = width;
    fluidHeight = height;
    canvas.width = width;
    canvas.height = height;
    velocity = createPair(width, height, gl.RGBA16F, gl.RGBA);
    density = createPair(width, height, gl.RGBA16F, gl.RGBA);
    temperature = createPair(width, height, gl.RGBA16F, gl.RGBA);
    pressure = createPair(width, height, gl.RGBA16F, gl.RGBA);
    divergence = createTarget(width, height, gl.RGBA16F, gl.RGBA);
    curl = createTarget(width, height, gl.RGBA16F, gl.RGBA);
    if (!velocity || !density || !temperature || !pressure || !divergence || !curl) {
      stop();
      hero.classList.remove("ink-live");
      canvas.dataset.fluidState = "target-error";
      return;
    }

    [velocity.a, velocity.b, density.a, density.b, temperature.a, temperature.b].forEach(
      clearTarget,
    );
    clearTarget(pressure.a);
    clearTarget(pressure.b);
    clearTarget(divergence);
    clearTarget(curl);
    resetSimulation();
  }

  function addDensity(amount) {
    const program = programs.addDensity;
    useProgram(program, density.b);
    bindTexture(0, density.a.texture);
    bindTexture(1, imageTexture);
    gl.uniform1i(program.uniforms.uDensity, 0);
    gl.uniform1i(program.uniforms.uImage, 1);
    gl.uniform2f(program.uniforms.uFluidSize, fluidWidth, fluidHeight);
    gl.uniform2f(
      program.uniforms.uImageSize,
      image.naturalWidth || 1583,
      image.naturalHeight || 800,
    );
    gl.uniform2f(
      program.uniforms.uObjectPosition,
      objectPosition[0],
      objectPosition[1],
    );
    gl.uniform1f(program.uniforms.uMix, amount);
    draw();
    const previous = density.a;
    density.a = density.b;
    density.b = previous;
  }

  function addVelocity(x, y, vx, vy, radius) {
    const program = programs.addVelocity;
    useProgram(program, velocity.b);
    bindTexture(0, velocity.a.texture);
    gl.uniform1i(program.uniforms.uVelocity, 0);
    gl.uniform2f(program.uniforms.uSourceSize, pointer.viewWidth, pointer.viewHeight);
    gl.uniform2f(program.uniforms.uTargetSize, fluidWidth, fluidHeight);
    gl.uniform2f(program.uniforms.uPosition, x, y);
    gl.uniform1f(program.uniforms.uRadius, radius);
    gl.uniform2f(program.uniforms.uValue, vx, vy);
    draw();
    const previous = velocity.a;
    velocity.a = velocity.b;
    velocity.b = previous;
  }

  function addTemperature(x, y, radius) {
    const program = programs.addTemperature;
    useProgram(program, temperature.b);
    bindTexture(0, temperature.a.texture);
    gl.uniform1i(program.uniforms.uTemperature, 0);
    gl.uniform2f(program.uniforms.uSourceSize, pointer.viewWidth, pointer.viewHeight);
    gl.uniform2f(program.uniforms.uTargetSize, fluidWidth, fluidHeight);
    gl.uniform2f(program.uniforms.uPosition, x, y);
    gl.uniform1f(program.uniforms.uRadius, radius);
    draw();
    const previous = temperature.a;
    temperature.a = temperature.b;
    temperature.b = previous;
  }

  function advect(sourcePair, dissipation) {
    const program = programs.advect;
    useProgram(program, sourcePair.b);
    bindTexture(0, velocity.a.texture);
    bindTexture(1, sourcePair.a.texture);
    gl.uniform1i(program.uniforms.uVelocity, 0);
    gl.uniform1i(program.uniforms.uSource, 1);
    gl.uniform2f(program.uniforms.uTexel, 1 / fluidWidth, 1 / fluidHeight);
    gl.uniform1f(program.uniforms.uDissipation, dissipation);
    draw();
    const previous = sourcePair.a;
    sourcePair.a = sourcePair.b;
    sourcePair.b = previous;
  }

  function applyBuoyancy() {
    const program = programs.buoyancy;
    useProgram(program, velocity.b);
    bindTexture(0, velocity.a.texture);
    bindTexture(1, temperature.a.texture);
    bindTexture(2, density.a.texture);
    gl.uniform1i(program.uniforms.uVelocity, 0);
    gl.uniform1i(program.uniforms.uTemperature, 1);
    gl.uniform1i(program.uniforms.uDensity, 2);
    draw();
    const previous = velocity.a;
    velocity.a = velocity.b;
    velocity.b = previous;
  }

  function applyVorticity() {
    let program = programs.curl;
    useProgram(program, curl);
    bindTexture(0, velocity.a.texture);
    gl.uniform1i(program.uniforms.uVelocity, 0);
    gl.uniform2i(program.uniforms.uSize, fluidWidth, fluidHeight);
    draw();

    program = programs.vorticity;
    useProgram(program, velocity.b);
    bindTexture(0, velocity.a.texture);
    bindTexture(1, curl.texture);
    gl.uniform1i(program.uniforms.uVelocity, 0);
    gl.uniform1i(program.uniforms.uCurl, 1);
    gl.uniform2i(program.uniforms.uSize, fluidWidth, fluidHeight);
    draw();
    const previous = velocity.a;
    velocity.a = velocity.b;
    velocity.b = previous;
  }

  function projectVelocity() {
    let program = programs.divergence;
    useProgram(program, divergence);
    bindTexture(0, velocity.a.texture);
    gl.uniform1i(program.uniforms.uVelocity, 0);
    gl.uniform2i(program.uniforms.uSize, fluidWidth, fluidHeight);
    draw();

    clearTarget(pressure.a);
    program = programs.jacobi;
    useProgram(program, pressure.b);
    for (let iteration = 0; iteration < 40; iteration++) {
      bindTexture(0, pressure.a.texture);
      bindTexture(1, divergence.texture);
      gl.uniform1i(program.uniforms.uPressure, 0);
      gl.uniform1i(program.uniforms.uDivergence, 1);
      gl.uniform2i(program.uniforms.uSize, fluidWidth, fluidHeight);
      draw();
      const previous = pressure.a;
      pressure.a = pressure.b;
      pressure.b = previous;
      gl.bindFramebuffer(gl.FRAMEBUFFER, pressure.b.framebuffer);
      gl.viewport(0, 0, fluidWidth, fluidHeight);
    }

    program = programs.gradient;
    useProgram(program, velocity.b);
    bindTexture(0, velocity.a.texture);
    bindTexture(1, pressure.a.texture);
    gl.uniform1i(program.uniforms.uVelocity, 0);
    gl.uniform1i(program.uniforms.uPressure, 1);
    gl.uniform2i(program.uniforms.uSize, fluidWidth, fluidHeight);
    draw();
    const previous = velocity.a;
    velocity.a = velocity.b;
    velocity.b = previous;
  }

  function splatPointer() {
    if (!pointer.active) return;
    const dx = pointer.x - pointer.previousX;
    const dy = pointer.y - pointer.previousY;
    if (pointer.right) {
      addTemperature(pointer.x, pointer.y, 15);
    } else {
      addVelocity(pointer.x, pointer.y, dx * 15, dy * 15, 25);
    }
    pointer.previousX = pointer.x;
    pointer.previousY = pointer.y;
  }

  function ambientInk(now) {
    if (pointer.active || now < ambientNext) return;
    const time = now * 0.00058;
    const x = 0.67 + Math.sin(time * 0.83) * 0.13;
    const y = 0.39 + Math.cos(time * 0.61) * 0.12;
    const vx = 4.2 + Math.cos(time * 0.73) * 2.0;
    const vy = Math.sin(time * 0.91) * 2.4;
    addVelocity(x, y, vx, vy, 30);
    ambientNext = now + 950;
  }

  function stepFluid() {
    advect(velocity, Math.pow(0.88, 0.05));
    advect(density, Math.pow(0.99, 0.05));
    advect(temperature, Math.pow(0.70, 0.05));
    splatPointer();
    ambientInk(performance.now());
    addDensity(simulationStep === 0 ? 1.0 : 0.009);
    applyBuoyancy();
    applyVorticity();
    projectVelocity();
    simulationStep++;
  }

  function drawFluid() {
    const program = programs.display;
    useProgram(program, null);
    bindTexture(0, density.a.texture);
    gl.uniform1i(program.uniforms.uDensity, 0);
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    draw();
    gl.disable(gl.BLEND);
  }

  function resetSimulation() {
    if (!velocity || !density) return;
    [velocity.a, velocity.b, temperature.a, temperature.b, pressure.a, pressure.b].forEach(
      clearTarget,
    );
    clearTarget(divergence);
    clearTarget(curl);
    clearTarget(density.a);
    clearTarget(density.b);
    simulationStep = 0;
    addDensity(1.0);
    drawFluid();
    pointer.previousX = pointer.x;
    pointer.previousY = pointer.y;
  }

  function frame() {
    if (!running) return;
    animationFrame = requestAnimationFrame(frame);
    const view = hero.closest(".view");
    if (document.hidden || !heroVisible || (view && !view.classList.contains("on"))) return;
    if (!paused) stepFluid();
    drawFluid();
    frameCount++;
    canvas.dataset.frame = String(frameCount);
  }

  function start() {
    if (running || !velocity) return;
    running = true;
    animationFrame = requestAnimationFrame(frame);
  }

  function resizeAndStart() {
    resizeSimulation();
    if (!velocity) return;
    hero.classList.add("ink-live");
    if (!paused) canvas.dataset.fluidState = "running";
    start();
  }

  function activateIfVisible() {
    if (!imageReady) return;
    const rect = hero.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    hero.classList.add("ink-live");
    resizeAndStart();
    if (velocity) canvas.dataset.fluidState = paused ? "paused" : "running";
    else hero.classList.remove("ink-live");
  }

  function stop() {
    running = false;
    cancelAnimationFrame(animationFrame);
  }

  function uploadImage() {
    if (!image.complete || !image.naturalWidth) {
      image.addEventListener("load", uploadImage, { once: true });
      return;
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    bindTexture(0, imageTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      image,
    );
    imageReady = true;
    activateIfVisible();
    if (!velocity) {
      if (hero.getBoundingClientRect().width) {
        canvas.dataset.fluidState = "target-error";
      } else {
        canvas.dataset.fluidState = "waiting-for-home";
      }
      return;
    }
    canvas.dataset.fluidState = "running";
    start();
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = event.clientX - rect.left;
    const yFromTop = event.clientY - rect.top;
    if (x < -30 || x > rect.width + 30 || yFromTop < -30 || yFromTop > rect.height + 30) {
      return null;
    }
    return {
      x: Math.max(0, Math.min(rect.width, x)),
      y: Math.max(0, Math.min(rect.height, rect.height - yFromTop)),
      width: rect.width,
      height: rect.height,
    };
  }

  hero.addEventListener("pointerdown", event => {
    if (!hero.classList.contains("ink-live")) return;
    const position = pointerPosition(event);
    if (!position) return;
    pointer.active = true;
    pointer.right = event.button === 2;
    pointer.x = position.x;
    pointer.y = position.y;
    pointer.previousX = position.x;
    pointer.previousY = position.y;
    pointer.viewWidth = position.width;
    pointer.viewHeight = position.height;
    if (event.pointerType !== "mouse") {
      try {
        hero.setPointerCapture(event.pointerId);
      } catch (error) {
        /* Pointer capture is optional. */
      }
    }
    start();
  }, { passive: true });

  hero.addEventListener("pointermove", event => {
    if (!hero.classList.contains("ink-live")) return;
    const position = pointerPosition(event);
    if (!position) return;
    pointer.viewWidth = position.width;
    pointer.viewHeight = position.height;
    pointer.x = position.x;
    pointer.y = position.y;
    const now = performance.now();
    if (!pointer.active && event.pointerType === "mouse" && now - lastHoverInk > 70) {
      addVelocity(
        position.x,
        position.y,
        Math.max(-60, Math.min(60, event.movementX * 15)),
        Math.max(-60, Math.min(60, -event.movementY * 15)),
        20,
      );
      lastHoverInk = now;
    }
  }, { passive: true });

  function releasePointer() {
    pointer.active = false;
    pointer.right = false;
  }

  hero.addEventListener("pointerup", releasePointer, { passive: true });
  hero.addEventListener("pointercancel", releasePointer, { passive: true });
  hero.addEventListener("pointerleave", event => {
    if (event.pointerType !== "mouse" || event.buttons === 0) releasePointer();
  }, { passive: true });
  hero.addEventListener("contextmenu", event => {
    if (hero.classList.contains("ink-live")) event.preventDefault();
  });

  new ResizeObserver(activateIfVisible).observe(hero);

  const homeView = hero.closest(".view");
  if (homeView) {
    new MutationObserver(activateIfVisible).observe(homeView, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }
  window.addEventListener("hashchange", activateIfVisible, { passive: true });

  const visibilityObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      heroVisible = entry.isIntersecting;
    });
  }, { threshold: 0.01 });
  visibilityObserver.observe(hero);

  document.addEventListener("keydown", event => {
    const view = hero.closest(".view");
    if (!view || !view.classList.contains("on") || !hero.classList.contains("ink-live")) return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    const key = event.key.toLowerCase();
    if (key === "r") resetSimulation();
    if (key === "p") {
      paused = !paused;
      canvas.dataset.fluidState = paused ? "paused" : "running";
    }
    if (event.key === "-" || event.key === "_") {
      gridScale = Math.min(4, gridScale + 1);
      resizeAndStart();
    }
    if (event.key === "+" || event.key === "=") {
      gridScale = Math.max(1, gridScale - 1);
      resizeAndStart();
    }
  });

  canvas.addEventListener("webglcontextlost", event => {
    event.preventDefault();
    stop();
    hero.classList.remove("ink-live");
    canvas.dataset.fluidState = "lost";
  });

  reducedMotion.addEventListener("change", event => {
    if (!event.matches) return;
    stop();
    hero.classList.remove("ink-live");
    canvas.dataset.fluidState = "reduced-motion";
  });

  uploadImage();
})();
