import GoldenLayout from 'golden-layout';
import React from 'react';
import ReactDOM from 'react-dom';
import Markdown from 'react-markdown';
import './css/main.css';
import 'litegraph.js/css/litegraph.css'
import AceEditor from 'react-ace';
import 'brace/mode/glsl';
// Import a Theme (okadia, github, xcode etc)
import 'brace/theme/tomorrow_night_eighties';
import { JSONEditor } from 'react-json-editor-viewer';
// import { LGraph, LGraphCanvas, LiteGraph, LGraphNode } from 'litegraph.js';
// import GLComponent from './glnodes';
import * as dat from 'dat.gui';
// import {Button, useState} from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { vec2, vec3, vec4, mat2, mat3, mat4, quat } from 'gl-matrix';
import { Modal, Button, FormControl } from 'react-bootstrap';

// var TokenString = require('glsl-tokenizer/string');
// var ParseTokens = require('glsl-parser/direct');
var glsl_parser = require('./3rdparty/glsl_parser/glsl_parser');
var LG = require('./3rdparty/litegraph');
let LGraph = LG.LGraph;
let LGraphCanvas = LG.LGraphCanvas;
let LiteGraph = LG.LiteGraph;
let LGraphNode = LG.LGraphNode;


function assert(condition) {
  if (!condition) {
    var message = "Assertion failed";
    if (typeof Error !== "undefined") {
      throw new Error(message);
    }
    throw message; // Fallback
  }
}

// Actually, lets make a global state object
let global_state = {};
// Reference to the litegraph instance
global_state.litegraph = new LGraph();
function init_litegraph(json) {
  global_state.litegraph.clear();
  global_state.litegraph.configure(json, false);
  for (let i in global_state._on_reset_table) {
    global_state._on_reset_table[i]();
  }
}

global_state.on_select = null;
global_state.on_deselect = null;
global_state.litegraph_canvas = null;
global_state._after_table = {};
global_state._onselect_table = [];
global_state.exec_after = (cmd_type, fn) => {
  if (!(cmd_type in global_state._after_table))
    global_state._after_table[cmd_type] = [];
  global_state._after_table[cmd_type].push(fn);
};
global_state.exec_on_select = (onselect, ondeselect) => {
  global_state._onselect_table.push({ onselect: onselect, ondeselect: ondeselect });
};
global_state.exec_selected = (nodes) => {
  for (let j in global_state._onselect_table) {
    let callback = global_state._onselect_table[j];
    for (let i in nodes) {
      callback.onselect(nodes[i]);
    }
  }
};
global_state.exec_deselected = (nodes) => {
  for (let j in global_state._onselect_table) {
    let callback = global_state._onselect_table[j];
    for (let i in nodes) {
      callback.ondeselect(nodes[i]);
    }
  }
};
global_state.exec = (cmd) => {
  switch (cmd.type) {
    case 'add_src': {
      let src_name = cmd.src_name;
      assert(!(src_name in global_state.litegraph.config.srcs));
      global_state.litegraph.config.srcs[src_name] = { code: "" };
    }
      break;
    case 'remove_src': {
      let src_name = cmd.src_name;
      assert(src_name in global_state.litegraph.config.srcs);
      delete global_state.litegraph.config.srcs[src_name];
    }
      break;
    default:
      throw Error("unrecognized command");
      break;
  }

  if (cmd.type in global_state._after_table) {
    for (let i in global_state._after_table[cmd.type]) {
      // console.log(global_state._after_table[cmd.type][i]);
      global_state._after_table[cmd.type][i](cmd);
    }
  }
};
global_state.viewport = { width: 512, height: 512 };
global_state._on_reset_table = [];
global_state.on_reset = (fn) => {
  global_state._on_reset_table.push(fn);
};
global_state.exec_reset = () => {
  global_state.litegraph.clear();
  global_state.litegraph.config.srcs = {};
  for (let i in global_state._on_reset_table) {
    global_state._on_reset_table[i]();
  }
};
global_state.get_src = (name) => {
  assert(name in global_state.litegraph.config.srcs);
  return global_state.litegraph.config.srcs[name].code;
};
global_state._scr_change_table = [];
// Just notify everyone about any change to any source
global_state.on_src_change = (fn) => {
  // if (!(name in global_state._scr_change_table))
  //   global_state._scr_change_table[name] = [];
  // global_state._scr_change_table[name].push(fn);
  global_state._scr_change_table.push(fn);
};
global_state.set_src = (name, text) => {
  global_state.litegraph.config.srcs[name].code = text;
  global_state._scr_change_table.forEach(fn => fn(name));
};
global_state.draw_triangle = (gl) => {
  var pipeline = {
    vs:
      `#version 300 es
      
      layout (location=0) in vec4 position;
      layout (location=1) in vec3 color;
      
      out vec3 vColor;

      void main() {

          vColor = color;
          gl_Position = position;
      }
      `,
    ps:
      `#version 300 es
      precision highp float;
      in vec3 vColor;
      out vec4 fragColor;

      void main() {
          fragColor = vec4(vColor, 1.0);
      }`,

  };
  var vsSource = pipeline.vs;
  var fsSource = pipeline.ps;

  var vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vsSource);
  gl.compileShader(vertexShader);

  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(vertexShader));
  }

  var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fsSource);
  gl.compileShader(fragmentShader);

  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(fragmentShader));
  }

  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
  }

  gl.useProgram(program);

  var triangleArray = gl.createVertexArray();
  gl.bindVertexArray(triangleArray);

  var positions = new Float32Array([
    -0.5, -0.5, 0.0,
    0.5, -0.5, 0.0,
    0.0, 0.5, 0.0
  ]);

  var positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  var colors = new Float32Array([
    1.0, 0.0, 0.0,
    0.0, 1.0, 0.0,
    1.0, 0.0, 0.0
  ]);

  var colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(1);

  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.SCISSOR_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  gl.deleteBuffer(positionBuffer);
  gl.deleteBuffer(colorBuffer);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  gl.deleteProgram(program);
};
global_state.render_texture = (tex) => {
  let gl = global_state.gl;
  var pipeline = {
    vs:
      `precision mediump float;
      attribute vec2 position;
      varying vec2 uv;
      void main() {
        uv = 0.5 * (position + 1.0);
        uv.y = 1.0 - uv.y;
        gl_Position = vec4(position, 0, 1);
      }
      `,
    ps:
      `precision mediump float;
      varying vec2 uv;
      uniform sampler2D in_tex;
      void main() {
        gl_FragColor = vec4(texture2D(in_tex, uv).xyz, 1.0);
      }`,

  };
  var vsSource = pipeline.vs;
  var fsSource = pipeline.ps;

  var vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vsSource);
  gl.compileShader(vertexShader);

  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(vertexShader));
  }

  var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fsSource);
  gl.compileShader(fragmentShader);

  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(fragmentShader));
  }

  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
  }

  gl.useProgram(program);

  var triangleArray = gl.createVertexArray();
  gl.bindVertexArray(triangleArray);

  var positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-4, -4, 4, -4, 0, 4]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);
  gl.activeTexture(gl.TEXTURE0 + 0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(gl.getUniformLocation(program, "in_tex"), 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  gl.deleteBuffer(positionBuffer);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  gl.deleteProgram(program);
  gl.deleteVertexArray(triangleArray);
};
global_state.get_texture_data = (tex) => {
  let gl = global_state.gl;
  // create to render to
  const targetTextureWidth = 256;
  const targetTextureHeight = 256;
  const targetTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, targetTexture);

  {
    // define size and format of level 0
    const level = 0;
    const internalFormat = gl.RGBA;
    const border = 0;
    const format = gl.RGBA;
    const type = gl.UNSIGNED_BYTE;
    const data = null;
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
      targetTextureWidth, targetTextureHeight, border,
      format, type, data);

    // set the filtering so we don't need mips
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  // Create and bind the framebuffer
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, targetTexture, 0);



  gl.disable(gl.CULL_FACE);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.SCISSOR_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.blendFunc(gl.ONE, gl.ONE);

  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
  gl.viewport(0, 0, targetTextureWidth, targetTextureHeight);
  gl.clearColor(0, 0, 1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  global_state.render_texture(tex);

  var data = new Uint8Array(targetTextureWidth * targetTextureHeight * 4);
  gl.readPixels(0, 0, targetTextureWidth, targetTextureHeight, gl.RGBA, gl.UNSIGNED_BYTE, data);


  gl.deleteFramebuffer(fb);
  gl.deleteTexture(targetTexture);

  let array = new Uint8ClampedArray(data);
  let image = new ImageData(array, targetTextureWidth, targetTextureHeight);
  return image;
}

// TODO:
// * src node/pipeline node
// * drawcall node
//   * input attribute stream
//   * input uniform hvalues(matrices, vector, float, ints, textures+texture sizes)
// * camera node(generates look,up,left vectors and view/projection/inverse matrices)
// * text code editing
//   * live update
// * pass node
//   * multiple drawcalls as inputs
//   * multiple output render targets
//   * live view render targets(configure custom visualization text)

class MyLGraphNode extends LGraphNode {
  constructor() {
    super();
    this.dirty  = true;
  }
  setDirty = (flag) => {this.dirty = flag;}
  isDirty = () => {return this.dirty};
}

class GLComponent extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.graph = new LGraph();
    this.canvas = null;
    this.onResize = this.onResize.bind(this);
  }

  componentDidMount() {
    this.canvas = document.getElementById("myglcanvas");
    this.gl = this.canvas.getContext('webgl2', { alpha: false });

    // return;
    let gl = this.gl;
    assert(gl.getExtension('EXT_color_buffer_float') != null);
    let canvas = this.canvas;
    global_state.gl = gl;
    global_state.draw_triangle(gl);
  }

  exec_graph = () => {

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

class BackBufferNode extends MyLGraphNode {
  constructor() {
    super();
    this.addInput("in", "texture_t");
    this.properties = {};
    this.title = "Back Buffer";
    let list = global_state.litegraph.findNodesByType("gfx/BackBufferNode");
    // Remove all backbuffer nodes
    // This enforces only one backbuffer node per graph
    if (list.length > 0) {
      for (let i = 0; i < list.length; i++) {
        global_state.litegraph.remove(list[i]);
      }
    }
  }
}

class PipelineNode extends MyLGraphNode {
  constructor() {
    super();

    this.properties = {
      vs: null,
      ps: null,
    };
    this.addOutput("out", "pipeline_t");
    this.title = "Pipeline";
    this.attributes = [];
    global_state.exec_after('remove_src', (cmd) => {
      if (cmd.src_name == this.vs) {
        this.set_vs(null);
      }
      if (cmd.src_name == this.ps) {
        this.set_ps(null);
      }
    });
    global_state.on_src_change((src_name) => {
      if (src_name == this.vs) {
      }
      if (src_name == this.ps) {
      }
    });
  }

  set_vs = (vs) => {
    this.properties.vs = vs;
  }

  set_ps = (ps) => {
    this.properties.ps = ps;
  }

  clean_inputs = () => {
    let len = this.inputs.length;
    for (let i = len - 1; i >= 0; i--) {
      this.removeInput(i);
    }
  }

  is_valid = () => {
    return this.properties.vs != null && this.properties.ps != null;
  }

  bind = (gl) => {
    if (!this.is_valid)
      return false;
    assert(!("gl" in this));
    this.gl = { vs: null, ps: null, program: null };
    let vs_source = global_state.get_src(this.properties.vs);
    this.gl.vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(this.gl.vs, vs_source);
    gl.compileShader(this.gl.vs);

    if (!gl.getShaderParameter(this.gl.vs, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(this.gl.vs));
      this.release(gl);
      return false;
    }

    let ps_source = global_state.get_src(this.properties.ps);
    this.gl.ps = gl.createShader(gl.PIXEL_SHADER);
    gl.shaderSource(this.gl.ps, ps_source);
    gl.compileShader(this.gl.ps);

    if (!gl.getShaderParameter(this.gl.ps, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(this.gl.ps));
      this.release(gl);
      return false;
    }

    this.gl.program = gl.createProgram();
    gl.attachShader(this.gl.program, this.gl.ps);
    gl.attachShader(this.gl.program, this.gl.vs);
    gl.linkProgram(this.gl.program);

    if (!gl.getProgramParameter(this.gl.program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(this.gl.program));
      this.release(gl);
      return false;
    }

    gl.useProgram(this.gl.program);
    gl.enable(gl.CULL_FACE);
    gl.frontFace(gl.CW);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.SCISSOR_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    return true;
  }

  release = (gl) => {
    if (!("gl" in this))
      return;
    if (this.gl.vs != null) gl.deleteShader(this.gl.vs);
    if (this.gl.ps != null) gl.deleteShader(this.gl.ps);
    if (this.gl.program != null) gl.deleteProgram(this.gl.program);
    delete this.gl;
  }

  display = (propnode) => {

    let src_list = [];
    // console.log(pipeline);
    let datgui_state = {
      select_vs: this.properties.vs,
      select_ps: this.properties.ps,
    };
    Object.keys(global_state.litegraph.config.srcs).forEach(e => src_list.push(e));
    propnode.datgui.add(datgui_state, 'select_vs', src_list)
      .onChange((v) => this.set_vs(v));
    propnode.datgui.add(datgui_state, 'select_ps', src_list)
      .onChange((v) => this.set_ps(v));
  }

  parse_shaders() {
    this.clean_inputs();
    this.attributes = [];
    if (this.properties.vs != null) {
      try {
        // Parse vertex shader for attributes
        var ast = glsl_parser.parse(global_state.get_src(this.properties.vs));

        if (ast.type != "root")
          throw Error();
        ast.statements.forEach(s => {
          if (s.type == "declarator") {
            if (s.typeAttribute.qualifier == "attribute") {
              this.attributes.push({ name: s.declarators[0].name.name, type: s.typeAttribute.name });
            }
          }
        });
      } catch (e) {
        console.log(e);
      }
    }
    // console.log(this.attributes);
    return this.attributes;
  }

  onSelected() {
  }

  onDeselected() {
  }

}

class DrawCallNode extends MyLGraphNode {
  constructor() {
    super();
    this.addOutput("out", "drawcall_t");
    this.addInput("pipeline", "pipeline_t");
    this.title = "Draw Call";
    this.onConnectionsChange = (c_type, target_slot, flag, link_info, input) => {
      if (input.type == "pipeline_t") {
        this.update_inputs();
      }
    };
  }

  update_inputs = () => {
    // this.clearInput();
    for (var i = this.inputs.length - 1; i > 0; i--)
      this.removeInput(i)
    let pipeline = this.getInputNodeByName("pipeline");
    if (pipeline == null)
      return;
    let attributes = pipeline.parse_shaders();
    attributes.forEach(k => this.addInput(k.name, "attribute_t"));
  }

  onSelected() {
  }

  onDeselected() {
  }

}

class PassNode extends MyLGraphNode {
  constructor() {
    super();
    // this.addInput("in#0", "texture_t");
    // this.addInput("in#0", "vec4_t");
    // this.addOutput("out#0", "texture_t");
    // this.addDC = this.addDC.bind(this);
    // this.slider = this.addWidget("slider", "Slider", 0.5, function (v) { }, { min: 0, max: 1 });
    this.button = this.addWidget("button", "Update", null, (v) => { this.update_thumbnails(global_state.gl); }, {});
    this.button = this.addWidget("button", "Add DC", null, (v) => { this.addDC(); }, {});
    // this.properties = { dc_cnt: 0 };
    this.title = "Pass";
    this.properties = {
      viewport: { width: 512, height: 512 },
      rts: [],
      depth: null,
      dc_cnt: 0,
    };
    this.yoffset = 50;
    this.onPropertyChange = (prop, val) => {
      this.update_outputs();
    };
  }

  clear_outputs = () => {
    let len = this.outputs.length;
    for (let i = len - 1; i >= 0; i--) {
      this.removeOutput(i);
    }
    this.properties.dc_cnt = 0;
  }

  update_outputs = () => {
    this.clear_outputs();
    for (let i = 0; i < this.properties.rts.length; ++i) {
      this.addOutput("rt#" + i, "texture_t");
    }
    if (this.properties.depth != null) {
      this.addOutput("depth", "texture_t");
    }
  }

  push_rt = (params) => {
    let rt_params = {};
    rt_params.format = params.format;
    this.properties.rts.push(rt_params)
    this.update_outputs();
  }

  pop_rt = () => {
    // for (let i = this.properties.rts.length - 1; i >= 0; i--) {
    //   delete this.properties.rts[i];
    //   break;
    // }
    if (this.properties.rts.length == 0)
      return;
    this.properties.rts.pop();
    this.update_outputs();
  }

  add_depth = (params) => {
    if (this.properties.depth != null)
      return;
    let d_params = {};
    d_params.format = params.format;
    this.properties.depth = d_params;
    this.update_outputs();
  }

  remove_depth = () => {
    if (this.properties.depth == null)
      return;
    this.properties.depth = null;
    this.update_outputs();
  }

  set_width = (width) => {
    this.properties.viewport.width = width;
  }

  set_height = (height) => {
    this.properties.viewport.height = height;
  }

  onExecute() {
    // var A = this.getInputData(0);
    // if (A === undefined)
    //   A = 0;
    // var B = this.getInputData(1);
    // if (B === undefined)
    //   B = 0;
    // this.setOutputData(0, "texture_0");
  }

  gl_bind = (gl) => {
    this.gl = { fb: null, rts: [] };
    this.gl.fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.gl.fb);
    assert(this.properties.rts.length != 0 || this.properties.depth != null);
    let draw_buffers = [];
    this.gl.rts = [];
    for (let i = 0; i < this.properties.rts.length; ++i) {
      let rt = this.properties.rts[i];
      const tex = gl.createTexture();
      this.gl.rts.push(tex);
      draw_buffers.push(gl.COLOR_ATTACHMENT0 + i);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      var format = null;
      const level = 0;
      switch (rt.format) {
        case "RGBA_U8": {
          format = gl.RGBA8;
        }
          break;
        case "RGBA_F32": {
          format = gl.RGBA32F;
        }
          break;
        default:
          throw Error("unknown format");
      }
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texStorage2D(gl.TEXTURE_2D, 1, format, this.properties.viewport.width, this.properties.viewport.height);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, tex, level);
    }

    if (this.properties.depth != null) {
      let rt = this.properties.depth;
      const tex = gl.createTexture();
      this.gl.depth = tex;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      var format = null;
      let level = 0;
      switch (rt.format) {
        case "D16": {
          format = gl.DEPTH_COMPONENT16;
        }
          break;
        case "D32": {
          format = gl.DEPTH_COMPONENT32F;
        }
          break;
        default:
          throw Error("unknown format");
      }
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texStorage2D(gl.TEXTURE_2D, 1, format, this.properties.viewport.width, this.properties.viewport.height);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, level);
    }
    gl.drawBuffers(draw_buffers);
    gl.viewport(0, 0, this.properties.viewport.width, this.properties.viewport.height);
    gl.clearColor(0, 0, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  update_thumbnails = (gl) => {
    this.gl_bind(gl);

    global_state.draw_triangle(gl);

    let image_data = global_state.get_texture_data(this.gl.rts[0]);

    // let canvas_container = document.getElementById("myglcanvas_container");

    let tmp_canvas = document.createElement("canvas");
    // canvas_container.appendChild(tmp_canvas);
    let tmp_canvasContext = tmp_canvas.getContext("2d");
    tmp_canvas.width = image_data.width;
    tmp_canvas.height = image_data.height;
    tmp_canvasContext.putImageData(image_data, 0, 0);
    var img = document.createElement("img");
    img.src = tmp_canvas.toDataURL("image/png");
    this.thumbnails = [img];
    this.release(gl);
  }

  release = (gl) => {
    if (!("gl" in this))
      return;
    if (this.gl.vfbs != null) gl.deleteFramebuffer(this.gl.fb);
    for (let i = 0; i < this.gl.rts.length; ++i) {
      let tex = this.gl.rts[i];
      gl.deleteTexture(tex);
    }
    if (this.gl.depth)
      gl.deleteTexture(this.gl.depth);
    delete this.gl;
  }

  display = (propnode) => {

    let tmp_rt_state = {
      format: "RGBA_U8",
    };
    let tmp_d_state = {
      format: "D16",
    };
    let datgui_state = {
      width: this.properties.viewport.width,
      height: this.properties.viewport.height,
      push: () => {
        this.push_rt(tmp_rt_state);
        propnode.clear_gui();
        propnode.display_node(this);
      },
      pop: () => {
        this.pop_rt();
        propnode.clear_gui();
        propnode.display_node(this);
      },
      add_depth: () => {
        this.add_depth(tmp_d_state);
        propnode.clear_gui();
        propnode.display_node(this);
      },
      remove_depth: () => {
        this.remove_depth();
        propnode.clear_gui();
        propnode.display_node(this);
      },
    };
    let rts = propnode.datgui.addFolder("Render targets");
    for (let i in this.properties.rts) {
      let rt = this.properties.rts[i];
      let rt_state = {
        format: rt.format,
      };
      rts.add(rt_state, 'format');
    }
    if (this.properties.depth != null) {
      let rt_state = {
        format: this.properties.depth.format,
      };
      rts.add(rt_state, 'format');
    }
    rts.open();
    let new_rt = propnode.datgui.addFolder("Add render target");
    new_rt.add(tmp_rt_state, 'format', ["RGBA_U8", "RGBA_F32"]);
    new_rt.add(datgui_state, 'push');
    new_rt.add(datgui_state, 'pop');
    new_rt.open();
    let new_d = propnode.datgui.addFolder("Add depth target");
    new_d.add(tmp_d_state, 'format', ["D16", "D32"]);
    new_d.add(datgui_state, 'add_depth');
    new_d.add(datgui_state, 'remove_depth');
    new_d.open();
    let vp = propnode.datgui.addFolder("Viewport");
    vp.add(datgui_state, 'width', 1, 1024).onChange((v) => this.set_width(v));;
    vp.add(datgui_state, 'height', 1, 1024).onChange((v) => this.set_height(v));;
    vp.open();

    // this.datgui.add(this.datgui_state, 'select_vs', this.src_list)
    //   .onChange((v) => pipeline.set_vs(v));
    // this.datgui.add(this.datgui_state, 'select_ps', this.src_list)
    //   .onChange((v) => pipeline.set_ps(v));

  }

  onDrawBackground(ctx) {
    if (this.flags.collapsed) {
      return;
    }

    ctx.fillStyle = "#000";
    var yoffset = this.yoffset;
    var xoffset = 16;
    var border = 16;
    var size = this.size[0] - border * 2;;
    for (let i in this.properties.rts) {
      if ("thumbnails" in this && i < this.thumbnails.length) {
        ctx.drawImage(this.thumbnails[i], xoffset, yoffset, size, size);

      } else {
        ctx.fillRect(xoffset, yoffset, size, size);
      }
      yoffset += size + border;
    }
    if (this.properties.depth != null) {
      if ("depth_thumbnail" in this) {
        ctx.drawImage(this.depth_thumbnail, xoffset, yoffset, size, size);

      } else {
        ctx.fillRect(xoffset, yoffset, size, size);
      }
      yoffset += size + border;
    }
    // this.size[0] = xoffset + size + border;
    this.size[1] = yoffset;
    // ctx.fillRect(0, 0, size[0], size[1]);
    ctx.strokeStyle = "#555";


  }



  addDC() {
    this.addInput("DC#" + this.properties.dc_cnt, "drawcall_t");
    this.properties.dc_cnt += 1;
  }

  onMouseDown(e, local_pos) {

    // this.addOutput("A-B", "number");
  }

}

class GraphNodeComponent extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.graph = global_state.litegraph;
    this.onResize = this.onResize.bind(this);
    this.dumpJson = this.dumpJson.bind(this);
  }

  componentDidMount() {

    global_state.litegraph_canvas = new LGraphCanvas("#tmp_canvas", this.graph);
    global_state._selected_nodes = {};
    global_state.litegraph_canvas.onSelectionChange = (
      nodes
    ) => {
      // console.log("selection changed to"); console.log(nodes);
      let new_selected = [];
      let new_deselected = [];
      for (let i in nodes) {
        let node = nodes[i];
        if (!(node.id in global_state._selected_nodes)) {
          new_selected.push(node);
        }
      }
      for (let i in global_state._selected_nodes) {
        let node = global_state._selected_nodes[i];
        if (!(node.id in nodes)) {
          new_deselected.push(node);
        }
      }
      global_state._selected_nodes = { ...nodes };
      // console.log("new_selected"); console.log(new_selected);
      // console.log("new_deselected"); console.log(new_deselected);
      global_state.exec_selected(new_selected);
      global_state.exec_deselected(new_deselected);
    };
    // global_state.litegraph_canvas.onNodeSelected = (
    //   node
    // ) => {
    //   console.log("selected" + node);
    //   global_state.exec_selected([node]);
    // };

    // global_state.litegraph_canvas.onNodeDeselected = (
    //   node
    // ) => {
    //   console.log("deselected" + node);
    //   global_state.exec_deselected([node]);
    // };


    this.graph.start();

    this.props.glContainer.on('resize', this.onResize);
    global_state.litegraph_canvas.resize();

    // Register nodesw
    LiteGraph.registerNodeType("gfx/PassNode", PassNode);
    LiteGraph.registerNodeType("gfx/BackBufferNode", BackBufferNode);
    LiteGraph.registerNodeType("gfx/DrawCallNode", DrawCallNode);
    LiteGraph.registerNodeType("gfx/PipelineNode", PipelineNode);
    // Load default json scene
    init_litegraph(require('./default_graph.json'));
    this.dumpJson();
  }

  onResize() {
    global_state.litegraph_canvas.resize();
  }

  dumpJson() {
    var json = this.graph.serialize();
    console.log(JSON.stringify(json));


  }

  render() {

    return (
      <div style={{ width: '100%', height: '100%' }} id="tmp_canvas_container">
        <Button style={{ margin: 10 }} onClick={this.dumpJson}>
          log json
                </Button>
        <Button style={{ margin: 10 }} onClick={() => { console.log(global_state.litegraph_canvas.selected_nodes); }}>
          log selection
                </Button>
        <Button style={{ margin: 10 }} onClick={() => { global_state.exec_reset(); }}>
          clear graph
                </Button>
        <canvas id='tmp_canvas' width='50%' height='50%' style={{ border: '1px solid' }}></canvas>
      </div>
    );
  }
}

// A button that spawns a modal window with text input and submit button
// @TODO: validation
class CreateSrc extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.state = { visible: false };
    this.myInput = { value: "" };
  }
  setShow = (vis) => {
    this.setState({ visible: vis });
  }
  handleClose = () => this.setShow(false);
  handleShow = () => this.setShow(true);
  handleApply = () => {
    // console.log(this.myInput.value);
    this.props.on_submit(this.myInput.value);
    this.setShow(false);
  }
  render() {
    return (
      <>
        <Button variant="primary" onClick={this.handleShow}>
          New Source
      </Button>

        <Modal show={this.state.visible} onHide={this.handleClose}>
          <Modal.Header closeButton>
            <Modal.Title>Enter name</Modal.Title>
          </Modal.Header>
          <FormControl type="text" placeholder="source name" onChange={e => this.myInput.value = e.target.value} />
          <Modal.Footer>
            <Button variant="secondary" onClick={this.handleClose}>
              Cancel
          </Button>
            <Button variant="primary" onClick={() => this.handleApply()}>
              Create
          </Button>
          </Modal.Footer>
        </Modal>
      </>
    );
  }
}

class TextEditorComponent extends React.Component {

  constructor(props, context) {
    super(props, context);

    this.onChange = this.onChange.bind(this);
    this.onResize = this.onResize.bind(this);
    this.selected_src = null;
    global_state.exec_after('remove_src', (cmd) => {
      // console.log(cmd);
      if (cmd.src_name == this.selected_src) {
        this.edit_src(null);
        this.rebuildGui();
      }
    });
    global_state.on_reset(() => {
      this.edit_src(null);
      this.rebuildGui();
    });

  }

  rebuildGui = () => {
    this.datgui = new dat.GUI({ autoPlace: false });
    this.src_list = [];
    this.datgui_state = {
      select_src: this.selected_src,
      remove_src: () => { this.remove_src(); },
    };
    if ("srcs" in global_state.litegraph.config)
      Object.keys(global_state.litegraph.config.srcs).forEach(e => this.src_list.push(e));
    this.datgui.src_list = this.datgui.add(this.datgui_state, 'select_src', this.src_list)
      .onChange((v) => this.edit_src(v));
    this.datgui.add(this.datgui_state, 'remove_src');

    var customContainer = document.getElementById('teditor_gui_container');
    var child = customContainer.lastElementChild;
    while (child) {
      customContainer.removeChild(child);
      child = customContainer.lastElementChild;
    }
    customContainer.appendChild(this.datgui.domElement);
  }

  componentDidMount() {
    this.props.glContainer.on('resize', this.onResize);
    this.edit_src(null);
    this.rebuildGui();
  }

  edit_src = (name) => {
    if (name == null) {
      this.selected_src = null;
      this.refs.editor.editor.setValue("");
      return;
    }
    assert(name in global_state.litegraph.config.srcs);
    this.selected_src = name;
    this.refs.editor.editor.setValue(global_state.litegraph.config.srcs[name].code);
  }

  add_src = (name) => {
    global_state.exec({ type: 'add_src', src_name: name });
    this.edit_src(name);
    this.rebuildGui();

  }

  remove_src = () => {
    if (this.selected_src == null)
      return;
    global_state.exec({ type: 'remove_src', src_name: this.selected_src });

  }

  onChange(newValue) {
    if (this.selected_src == null)
      return;
    global_state.set_src(this.selected_src, newValue);
  }

  onResize() {
    this.refs.editor.editor.resize();
  }

  render() {

    return (
      <div className="ace_editor_container">
        <CreateSrc on_submit={(name) => this.add_src(name)} />
        <div id="teditor_gui_container">

        </div>
        <AceEditor
          value={this.text}
          ref="editor"
          mode="glsl"
          theme="tomorrow_night_eighties"
          onChange={this.onChange}
          name="UNIQUE_ID_OF_DIV"
          editorProps={{
            $blockScrolling: true
          }}
          autoScrollEditorIntoView={false}
          wrapEnabled={false}
          height="100%"
          width="100%"
        />
      </div>
    );
  }
}

class PropertiesNode extends React.Component {

  constructor(props, context) {
    super(props, context);
    this.selected_node = null;
    global_state.exec_on_select((selected_node) => {
      this.selected_node = selected_node;
      this.display_node(selected_node);
    },
      (deselected_node) => {
        if (this.selected_node == deselected_node) {
          this.selected_node = null;
          this.clear_gui();
        }
      });
    global_state.exec_after('remove_src', (cmd) => {
      this.clear_gui();
      this.display_node(this.selected_node);
    });
    global_state.exec_after('add_src', (cmd) => {
      this.clear_gui();
      this.display_node(this.selected_node);
    });
    global_state.on_reset(() => {
      this.clear_gui();
    });
  }

  clear_gui = () => {
    var customContainer = document.getElementById('PropertiesNodeWrapper');
    var child = customContainer.lastElementChild;
    while (child) {
      customContainer.removeChild(child);
      child = customContainer.lastElementChild;
    }
  }

  display_node = (node) => {
    if (node == null)
      return;
    this.datgui = new dat.GUI({ autoPlace: false });
    if ("display" in node) {
      node.display(this);
    }
    var customContainer = document.getElementById('PropertiesNodeWrapper');
    customContainer.appendChild(this.datgui.domElement);
    // if (this.selected_node != null) {
    //   if (this.selected_node.type == "gfx/PipelineNode") {
    //     this.display_pipeline(node);
    //   } else if (this.selected_node.type == "gfx/PassNode") {
    //     this.display_pass(node);
    //   }
    // }
  }

  componentDidMount() {

  }

  render() {

    return (
      <div id='PropertiesNodeWrapper'>
      </div>
    );
  }
}

class GoldenLayoutWrapper extends React.Component {
  constructor(props, context) {
    super(props, context);

  }

  componentDidMount() {
    this.globals = {};
    // Build basic golden-layout config
    const config = {
      content: [{
        type: 'row',
        content: [
          {
            type: 'react-component',
            isClosable: false,
            component: 'TextEditor',
            title: 'TextEditor',
            props: { globals: () => this.globals }


          },
          {
            type: 'react-component',
            isClosable: false,
            component: 'Graphs',
            title: 'Graphs',
            props: { globals: () => this.globals },
            width: 145

          },
          {
            type: 'column',
            width: 84,
            content: [{
              type: 'react-component',
              isClosable: false,
              component: 'GLW',
              title: 'GLW',
              height: 62,
              props: { globals: () => this.globals }

            }, {
              type: 'react-component',
              isClosable: false,
              component: 'PropertiesNode',
              title: 'PropertiesNode',
              props: { globals: () => this.globals }

            },
            ]
          }

        ]
      }]
    };

    var layout = new GoldenLayout(config, this.layout);
    this.layout = layout;
    layout.registerComponent('Graphs', GraphNodeComponent
    );
    layout.registerComponent('GLW', GLComponent
    );
    layout.registerComponent('TextEditor',
      TextEditorComponent
    );
    layout.registerComponent('PropertiesNode',
      PropertiesNode
    );
    layout.init();
    window.React = React;
    window.ReactDOM = ReactDOM;
    window.addEventListener('resize', () => {
      layout.updateSize();
    });

    // var reader = new FileReader();

    // reader.onload = function (theFile) {

    // };

    // reader.readAsDataURL('test.glsl');


    // fetch('shaders/test.glsl')
    //   .then(response => response.text())
    //   .then(text => {
    //     console.log(text);
    //     var tokens = TokenString(text);
    //     var ast = ParseTokens(tokens);
    //     console.log(ast);
    //   });

  }

  render() {

    return (
      <div className='goldenLayout'
        ref={input => this.layout = input} >
      </div>
    );
  }
}


export default GoldenLayoutWrapper;