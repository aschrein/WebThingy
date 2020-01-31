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



class GLComponent extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.graph = new LGraph();
    this.canvas = null;
    this.onResize = this.onResize.bind(this);
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

  componentDidMount() {
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

        var loader = new GLTFLoader().setPath('models/gltf/DamagedHelmet/glTF/');
        loader.load('DamagedHelmet.gltf', function (gltf) {

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
      <canvas id='myglcanvas' width='512' height='512' style={{ border: '1px solid' }}></canvas>

    );
  }
}

export default GLComponent;