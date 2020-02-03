import React from 'react';
import ReactDOM from 'react-dom';
import Markdown from 'react-markdown';
import { LGraph, LGraphCanvas, LiteGraph } from 'litegraph.js';
import { vec2, vec3, vec4, mat2, mat3, mat4, quat } from 'gl-matrix';
import * as THREE from 'three';

import Stats from 'three/examples/jsm/libs/stats.module.js';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { BloomPass } from 'three/examples/jsm/postprocessing/BloomPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { DotScreenPass } from 'three/examples/jsm/postprocessing/DotScreenPass.js';
import { MaskPass, ClearMaskPass } from 'three/examples/jsm/postprocessing/MaskPass.js';
import { TexturePass } from 'three/examples/jsm/postprocessing/TexturePass.js';

import { BleachBypassShader } from 'three/examples/jsm/shaders/BleachBypassShader.js';
import { ColorifyShader } from 'three/examples/jsm/shaders/ColorifyShader.js';
import { HorizontalBlurShader } from 'three/examples/jsm/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/examples/jsm/shaders/VerticalBlurShader.js';
import { SepiaShader } from 'three/examples/jsm/shaders/SepiaShader.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { RoughnessMipmapper } from 'three/examples/jsm/utils/RoughnessMipmapper.js';
import * as dat from 'dat.gui';


class GLComponent extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.graph = new LGraph();
    this.canvas = null;
    this.onResize = this.onResize.bind(this);
  }

  componentDidMount() {
    var canvas = document.getElementById("myglcanvas");
    // var context = canvas.getContext('webgl2', { alpha: false });
    var regl = require('regl')({
      canvas: canvas,
      extensions: ['webgl_draw_buffers', 'oes_texture_float']
    })

    const mat4 = require('gl-mat4')
    const camera = require('canvas-orbit-camera')(canvas)
    // window.addEventListener('resize', fit(canvas), false)
    const bunny = require('bunny')
    const normals = require('angle-normals')

    var sphereMesh = require('primitive-sphere')(1.0, {
      segments: 16
    })

    // configure intial camera view.
    camera.rotate([0.0, 0.0], [0.0, -0.4])
    camera.zoom(500.0) // 10.0

    const fbo = regl.framebuffer({
      color: [
        regl.texture({ type: 'float' }), // albedo
        regl.texture({ type: 'float' }), // normal
        regl.texture({ type: 'float' }) // position
      ],
      depth: true
    });

    var boxPosition = [
      // side faces
      [-0.5, +0.5, +0.5], [+0.5, +0.5, +0.5], [+0.5, -0.5, +0.5], [-0.5, -0.5, +0.5], // positive z face.
      [+0.5, +0.5, +0.5], [+0.5, +0.5, -0.5], [+0.5, -0.5, -0.5], [+0.5, -0.5, +0.5], // positive x face
      [+0.5, +0.5, -0.5], [-0.5, +0.5, -0.5], [-0.5, -0.5, -0.5], [+0.5, -0.5, -0.5], // negative z face
      [-0.5, +0.5, -0.5], [-0.5, +0.5, +0.5], [-0.5, -0.5, +0.5], [-0.5, -0.5, -0.5], // negative x face.
      [-0.5, +0.5, -0.5], [+0.5, +0.5, -0.5], [+0.5, +0.5, +0.5], [-0.5, +0.5, +0.5],  // top face
      [-0.5, -0.5, -0.5], [+0.5, -0.5, -0.5], [+0.5, -0.5, +0.5], [-0.5, -0.5, +0.5]  // bottom face
    ];

    const boxElements = [
      [2, 1, 0], [2, 0, 3],
      [6, 5, 4], [6, 4, 7],
      [10, 9, 8], [10, 8, 11],
      [14, 13, 12], [14, 12, 15],
      [18, 17, 16], [18, 16, 19],
      [20, 21, 22], [23, 20, 22]
    ];

    // all the normals of a single block.
    var boxNormal = [
      // side faces
      [0.0, 0.0, +1.0], [0.0, 0.0, +1.0], [0.0, 0.0, +1.0], [0.0, 0.0, +1.0],
      [+1.0, 0.0, 0.0], [+1.0, 0.0, 0.0], [+1.0, 0.0, 0.0], [+1.0, 0.0, 0.0],
      [0.0, 0.0, -1.0], [0.0, 0.0, -1.0], [0.0, 0.0, -1.0], [0.0, 0.0, -1.0],
      [-1.0, 0.0, 0.0], [-1.0, 0.0, 0.0], [-1.0, 0.0, 0.0], [-1.0, 0.0, 0.0],
      // top
      [0.0, +1.0, 0.0], [0.0, +1.0, 0.0], [0.0, +1.0, 0.0], [0.0, +1.0, 0.0],
      // bottom
      [0.0, -1.0, 0.0], [0.0, -1.0, 0.0], [0.0, -1.0, 0.0], [0.0, -1.0, 0.0]
    ];

    // The view and projection matrices of the camera are used all over the place,
    // so we put them in the global scope for easy access.
    const globalScope = regl({
      uniforms: {
        view: () => camera.view(),
        projection: ({ viewportWidth, viewportHeight }) =>
          mat4.perspective([],
            Math.PI / 4,
            viewportWidth / viewportHeight,
            0.01,
            2000)
      }
    });

    const outputGBuffer = regl({
      frag: `
    #extension GL_EXT_draw_buffers : require
      precision mediump float;
      varying vec3 vNormal;
      varying vec3 vPosition;
      uniform vec3 color;
      void main () {
        // just output geometry data.
        gl_FragData[0] = vec4(color, 1.0);
        gl_FragData[1] = vec4(vNormal, 0.0);
        gl_FragData[2] = vec4(vPosition, 0.0);
      }`,
      vert: `
      precision mediump float;
      attribute vec3 position;
      attribute vec3 normal;
      varying vec3 vPosition;
      varying vec3 vNormal;
      uniform mat4 projection, view, model;
      void main() {
        vNormal = normal;
        vec4 worldSpacePosition = model * vec4(position, 1);
        vPosition = worldSpacePosition.xyz;
        gl_Position = projection * view * worldSpacePosition;
      }`,
      framebuffer: fbo
    })

    // draw a directional light as a full-screen pass.
    const drawDirectionalLight = regl({
      frag: `
      precision mediump float;
      varying vec2 uv;
      uniform sampler2D albedoTex, normalTex;
      uniform vec3 ambientLight;
      uniform vec3 diffuseLight;
      uniform vec3 lightDir;
      void main() {
        vec3 albedo = texture2D(albedoTex, uv).xyz;
        vec3 n = texture2D(normalTex, uv).xyz;
        vec3 ambient = ambientLight * albedo;
        vec3 diffuse = diffuseLight * albedo * clamp(dot(n, lightDir) , 0.0, 1.0 );
        gl_FragColor = vec4(ambient + diffuse, 1.0);
      }`,
      vert: `
      precision mediump float;
      attribute vec2 position;
      varying vec2 uv;
      void main() {
        uv = 0.5 * (position + 1.0);
        gl_Position = vec4(position, 0, 1);
      }`,
      attributes: {
        // We implement the full-screen pass by using a full-screen triangle
        position: [-4, -4, 4, -4, 0, 4]
      },
      uniforms: {
        albedoTex: fbo.color[0],
        normalTex: fbo.color[1],
        ambientLight: [0.3, 0.3, 0.3],
        diffuseLight: [0.7, 0.7, 0.7],
        lightDir: [0.39, 0.87, 0.29]
      },
      depth: { enable: false },
      count: 3
    })

    const drawPointLight = regl({
      depth: { enable: false },
      frag: `
      precision mediump float;
      varying vec2 uv;
      varying vec4 vPosition;
      uniform vec3 ambientLight;
      uniform vec3 diffuseLight;
      uniform float lightRadius;
      uniform vec3 lightPosition;
      uniform sampler2D albedoTex, normalTex, positionTex;
      void main() {
        // get screen-space position of light sphere
        // (remember to do perspective division.)
        vec2 uv = (vPosition.xy / vPosition.w ) * 0.5 + 0.5;
        vec3 albedo = texture2D(albedoTex, uv).xyz;
        vec3 n = texture2D(normalTex, uv).xyz;
        vec4 position = texture2D(positionTex, uv);
        vec3 toLightVector = position.xyz - lightPosition;
        float lightDist = length(toLightVector);
        vec3 l = -toLightVector / ( lightDist );
        // fake z-test
        float ztest = step(0.0, lightRadius - lightDist );
        float attenuation = (1.0 - lightDist / lightRadius);
        vec3 ambient = ambientLight * albedo;
        vec3 diffuse = diffuseLight * albedo * clamp( dot(n, l ), 0.0, 1.0 );
        gl_FragColor = vec4((diffuse+ambient)
                            * ztest
                            * attenuation
                            ,1.0);
      }`,

      vert: `
      precision mediump float;
      uniform mat4 projection, view, model;
      attribute vec3 position;
      varying vec4 vPosition;
      void main() {
        vec4 pos = projection * view * model * vec4(position, 1);
        vPosition = pos;
        gl_Position = pos;
      }`,
      uniforms: {
        albedoTex: fbo.color[0],
        normalTex: fbo.color[1],
        positionTex: fbo.color[2],
        ambientLight: regl.prop('ambientLight'),
        diffuseLight: regl.prop('diffuseLight'),
        lightPosition: regl.prop('translate'),
        lightRadius: regl.prop('radius'),
        model: (_, props, batchId) => {
          var m = mat4.identity([])

          mat4.translate(m, m, props.translate)

          var r = props.radius
          mat4.scale(m, m, [r, r, r])

          return m
        }
      },
      attributes: {
        position: () => sphereMesh.positions,
        normal: () => sphereMesh.normals
      },
      elements: () => sphereMesh.cells,
      // we use additive blending to combine the
      // light spheres with the framebuffer.
      blend: {
        enable: true,
        func: {
          src: 'one',
          dst: 'one'
        }
      },
      cull: {
        enable: true
      },
      // We render only the inner faces of the light sphere.
      // In other words, we render the back-faces and not the front-faces of the sphere.
      // If we render the front-faces, the lighting of the light sphere disappears if
      // we are inside the sphere, which is weird. But by rendering the back-faces instead,
      // we solve this problem.
      frontFace: 'cw'
    })

    function Mesh(elements, position, normal) {
      this.elements = elements
      this.position = position
      this.normal = normal
    }

    Mesh.prototype.draw = regl({
      uniforms: {
        model: (_, props, batchId) => {
          // we create the model matrix by combining
          // translation, scaling and rotation matrices.
          var m = mat4.identity([])

          mat4.translate(m, m, props.translate)
          var s = props.scale

          if (typeof s === 'number') {
            mat4.scale(m, m, [s, s, s])
          } else { // else, we assume an array
            mat4.scale(m, m, s)
          }

          if (typeof props.yRotate !== 'undefined') {
            mat4.rotateY(m, m, props.yRotate)
          }

          return m
        },
        color: regl.prop('color')
      },
      attributes: {
        position: regl.this('position'),
        normal: regl.this('normal')
      },
      elements: regl.this('elements'),
      cull: {
        enable: true
      }
    })

    var bunnyMesh = new Mesh(bunny.cells, bunny.positions, normals(bunny.cells, bunny.positions))
    var boxMesh = new Mesh(boxElements, boxPosition, boxNormal)

    var drawGeometry = () => {
      var S = 800 // plane size
      var T = 0.1 // plane thickness
      var C = [0.45, 0.45, 0.45] // plane color

      //
      // First we place out lots of bunnies.
      //

      var bunnies = []
      var N_BUNNIES = 5 // number of bunnies.

      function negMod(x, n) {  // modulo that works for negative numbers
        return ((x % n) + n) % n
      }

      var x
      var z

      // There's lots of magic numbers below, and they were simply chosen because
      // they make it looks good. There's no deeper meaning behind them.
      for (x = -N_BUNNIES; x <= +N_BUNNIES; x++) {
        for (z = -N_BUNNIES; z <= +N_BUNNIES; z++) {
          // we use these two to generate pseudo-random numbers.
          var xs = x / (N_BUNNIES + 1)
          var zs = z / (N_BUNNIES + 1)

          // pseudo-random color
          var c = [
            ((Math.abs(3 * x + 5 * z + 100) % 10) / 10) * 0.64,
            ((Math.abs(64 * x + x * z + 23) % 13) / 13) * 0.67,
            ((Math.abs(143 * x * z + x * z * z + 19) % 11) / 11) * 0.65
          ]

          var A = S / 20 // max bunny displacement amount.
          // compute random bunny displacement
          var xd = (negMod(z * z * 231 + x * x * 343, 24) / 24) * 0.97 * A
          var zd = (negMod(z * x * 198 + x * x * z * 24, 25) / 25) * 0.987 * A

          // random bunny scale.
          var s = ((Math.abs(3024 * z + 5239 * x + 1321) % 50) / 50) * 3.4 + 0.9
          // random bunny rotation
          var r = ((Math.abs(9422 * z * x + 3731 * x * x + 2321) % 200) / 200) * 2 * Math.PI

          // translation
          var t = [xs * S / 2.0 + xd, -0.2, zs * S / 2.0 + zd]

          bunnies.push({ scale: s, translate: t, color: c, yRotate: r })
        }
      }

      //
      // Then we draw.
      //

      bunnyMesh.draw(bunnies)
      boxMesh.draw({ scale: [S, T, S], translate: [0.0, 0.0, 0], color: C })
    }

    var drawPointLights = (tick) => {
      //
      // First we place out the point lights
      //
      var pointLights = []

      // There's lots of magic numbers below, and they were simply chosen because
      // they make it looks good. There's no deeper meaning behind them.
      function makeRose(args) {
        var N = args.N // the number of points.
        var n = args.n // See the wikipedia article for a definition of n and d.
        var d = args.d // See the wikipedia article for a definition of n and d.
        var v = args.v // how fast the points traverse on the curve.
        var R = args.R // the radius of the rose curve.
        var s = args.s // use this parameter to spread out the points on the rose curve.
        var seed = args.seed // random seed

        for (var j = 0; j < N; ++j) {
          var theta = s * 2 * Math.PI * i * (1.0 / (N))
          theta += tick * 0.01

          var i = j + seed

          var a = 0.8

          var r = ((Math.abs(23232 * i * i + 100212) % 255) / 255) * 0.8452
          var g = ((Math.abs(32278 * i + 213) % 255) / 255) * 0.8523
          var b = ((Math.abs(3112 * i * i * i + 2137 + i) % 255) / 255) * 0.8523

          var rad = ((Math.abs(3112 * i * i * i + 2137 + i * i + 232 * i) % 255) / 255) * 0.9 * 30.0 + 30.0
          // See the wikipedia article for a definition of n and d.
          var k = n / d
          pointLights.push({
            radius: rad, translate:
              [R * Math.cos(k * theta * v) * Math.cos(theta * v), 20.9, R * Math.cos(k * theta * v) * Math.sin(theta * v)],
            ambientLight: [a * r, a * g, a * b], diffuseLight: [r, g, b]
          })
        }
      }

      // We make the point lights move on rose curves. This looks rather cool.
      // https://en.wikipedia.org/wiki/Rose_(mathematics)
      makeRose({ N: 10, n: 3, d: 1, v: 0.4, R: 300, seed: 0, s: 1 })
      makeRose({ N: 20, n: 7, d: 4, v: 0.6, R: 350, seed: 3000, s: 1 })
      makeRose({ N: 20, n: 10, d: 6, v: 0.7, R: 350, seed: 30000, s: 1 })
      makeRose({ N: 40, n: 7, d: 9, v: 0.7, R: 450, seed: 60000, s: 10 })

      //
      // Next, we draw all point lights as spheres.
      //
      drawPointLight(pointLights)
    }
    var printed = false;
    regl.frame(({ tick, viewportWidth, viewportHeight }) => {
      fbo.resize(viewportWidth, viewportHeight)

      globalScope(() => {
        // First we draw all geometry, and output their normals,
        // positions and albedo colors to the G-buffer
        outputGBuffer(() => {
          regl.clear({
            color: [0, 0, 0, 255],
            depth: 1
          })

          drawGeometry()
        })

        // We have a single directional light in the scene.
        // We draw it as a full-screen pass.
        drawDirectionalLight()

        // next, we draw all point lights as spheres.
        drawPointLights(tick)
      })

      camera.tick()
      if (!printed) {
        const tmp_fbo = regl.framebuffer({
          color: [
            regl.texture({ type: 'uint8' })
          ]
        });
        tmp_fbo.resize(fbo.width, fbo.height);
        var draw_fs = regl({
          frag: `
          precision mediump float;
          varying vec2 uv;
          uniform sampler2D in_tex;
          void main() {
            gl_FragColor = vec4(texture2D(in_tex, uv).xyz, 1.0);
          }`,
          vert: `
          precision mediump float;
          attribute vec2 position;
          varying vec2 uv;
          void main() {
            uv = 0.5 * (position + 1.0);
            gl_Position = vec4(position, 0, 1);
          }`,
          attributes: {
            // We implement the full-screen pass by using a full-screen triangle
            position: [-4, -4, 4, -4, 0, 4]
          },
          uniforms: {
            in_tex: fbo.color[1]
          },
          depth: { enable: false },
          count: 3
        });


        console.log(fbo);
        var result
        regl({ framebuffer: tmp_fbo })(() => {
          draw_fs();
          result = regl.read();

        });
        tmp_fbo.destroy();
        printed = true;
        // var canvas_container = document.getElementById("myglcanvas_container");
        // var myCanvas = document.createElement("canvas");
        // canvas_container.appendChild(myCanvas);
        // myCanvas.width = fbo.color[0].width;
        // myCanvas.height = fbo.color[0].height;
        // var myCanvasContext = myCanvas.getContext("2d"); // Get canvas 2d context
        // // var b64imgData = btoa(result); //Binary to ASCII, where it probably stands for
        // var array = new Uint8ClampedArray(result);
        // var image = new ImageData(array, fbo.width, fbo.height);
        // myCanvasContext.putImageData(image, 0, 0);
        // // myCanvasContext.drawImage(img, 0, 0); // Draw the texture
        // console.log(result);
        
      }
    })


    // This clears the color buffer to black and the depth buffer to 1
    //   regl.clear({
    //     color: [0, 0, 0, 1],
    //     depth: 1
    //   });

    //   // In regl, draw operations are specified declaratively using. Each JSON
    //   // command is a complete description of all state. This removes the need to
    //   // .bind() things like buffers or shaders. All the boilerplate of setting up
    //   // and tearing down state is automated.
    //   regl({

    //     // In a draw call, we can pass the shader source code to regl
    //     frag: `
    // precision mediump float;
    // uniform vec4 color;
    // void main () {
    //   gl_FragColor = color;
    // }`,

    //     vert: `
    // precision mediump float;
    // attribute vec2 position;
    // void main () {
    //   gl_Position = vec4(position, 0, 1);
    // }`,

    //     attributes: {
    //       position: [
    //         [-1, 0],
    //         [0, -1],
    //         [1, 1]
    //       ]
    //     },

    //     uniforms: {
    //       color: [1, 0, 0, 1]
    //     },

    //     count: 3
    //   })();
  }

  componentDidMount3() {

    var camera, scene;
    var canvas = document.getElementById("myglcanvas");
    var context = canvas.getContext('webgl2', { alpha: false });
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, context: context });
    var geometry, material, mesh;
    camera = new THREE.PerspectiveCamera(70, 1.0, 0.01, 10);
    camera.position.z = 1;

    scene = new THREE.Scene();

    geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    // material = new THREE.MeshNormalMaterial();
    var vs = "#version 300 es\n" +
      "void main() {" +
      "	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );" +
      "}";

    var ps = "#version 300 es\n" +
      "precision highp float;" +
      "precision highp int;" +
      "out vec4 out_FragColor;" +
      "void main() {" +
      "	out_FragColor = vec4( 1.0 );" +
      "}";
    material = new THREE.ShaderMaterial({
      vertexShader: vs,
      fragmentShader: ps
    });
    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(512, 512);
    // document.body.appendChild(renderer.domElement);


    mesh.rotation.x += 0.01;
    mesh.rotation.y += 0.02;

    renderer.render(scene, camera);
  }

  componentDidMount4() {
    var canvas = document.getElementById("myglcanvas");
    var context = canvas.getContext('webgl2', { alpha: false });
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, context: context });
    var controls;
    var camera, scene;
    camera = new THREE.PerspectiveCamera(45, 1.0, 0.25, 20);
    camera.position.set(- 1.8, 0.6, 2.7);

    scene = new THREE.Scene();
    var geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    // material = new THREE.MeshNormalMaterial();
    var vs = "#version 300 es\n" +
      "void main() {\n" +
      "	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n" +
      "}\n";

    var ps = "#version 300 es\n" +
      "precision highp float;\n" +
      "precision highp int;\n" +
      "out vec4 out_FragColor;\n" +
      "void main() {\n" +
      "	out_FragColor = vec4( 1.0 );\n" +
      "}\n";
    console.log(vs);
    var material = new THREE.ShaderMaterial({
      vertexShader: vs,
      fragmentShader: ps
    });
    var mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    var render = function () {
      renderer.render(scene, camera);
    };
    new RGBELoader()
      .setDataType(THREE.UnsignedByteType)
      .setPath('textures/equirectangular/')
      .load('royal_esplanade_1k.hdr', function (texture) {

        var envMap = pmremGenerator.fromEquirectangular(texture).texture;

        scene.background = envMap;
        scene.environment = envMap;

        texture.dispose();
        pmremGenerator.dispose();

        render();

        // model

        // use of RoughnessMipmapper is optional
        var roughnessMipmapper = new RoughnessMipmapper(renderer);

        var loader = new GLTFLoader();
        loader.load('models/gltf/LeePerrySmith/LeePerrySmith.glb', function (gltf) {

          gltf.scene.traverse(function (child) {

            if (child.isMesh) {

              roughnessMipmapper.generateMipmaps(child.material);

            }

          });

          scene.add(gltf.scene);

          roughnessMipmapper.dispose();

          render();

        });

      });

    renderer.setPixelRatio(1.0);
    renderer.setSize(512, 512);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    renderer.outputEncoding = THREE.sRGBEncoding;


    var pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    controls = new OrbitControls(camera, renderer.domElement);
    controls.addEventListener('change', render); // use if there is no animation loop
    controls.minDistance = 2;
    controls.maxDistance = 10
    controls.target.set(0, 0, - 0.2);
    controls.update();
    camera.aspect = 1.0;
    camera.updateProjectionMatrix();

    renderer.setSize(512, 512);

    renderer.render(scene, camera);


    

  }


  onResize() {
    this.canvas.resize();
  }


  render() {

    return (
      <div id="myglcanvas_container">
        <canvas id='myglcanvas' width='512' height='512' style={{ border: '1px solid' }}></canvas>
      </div>
    );
  }
}

export default GLComponent;