import GoldenLayout from 'golden-layout';
import React from 'react';
import ReactDOM from 'react-dom';
// import Markdown from 'react-markdown';
import './css/main.css';
import 'litegraph.js/css/litegraph.css'
import AceEditor from 'react-ace';
import 'brace/mode/glsl';
import 'brace/theme/tomorrow_night_eighties';
import 'brace/ext/language_tools';
// import { JSONEditor } from 'react-json-editor-viewer';
import * as dat from 'dat.gui';
import 'bootstrap/dist/css/bootstrap.min.css';
// import { vec2, vec3, vec4, mat2, mat3, mat4, quat } from 'gl-matrix';
import { Modal, Button, FormControl, Dropdown, DropdownButton } from 'react-bootstrap';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils';
// import { RoughnessMipmapper } from 'three/examples/jsm/utils/RoughnessMipmapper.js';

var LG = require('./3rdparty/litegraph');
var LGraph = LG.LGraph;
var LGraphCanvas = LG.LGraphCanvas;
var LiteGraph = LG.LiteGraph;
var LGraphNode = LG.LGraphNode;

let isSetsEqual = (a, b) => a.size === b.size && [...a].every(value => b.has(value));
function assert(condition) {
  if (!condition) {
    var message = "Assertion failed";
    if (typeof Error !== "undefined") {
      throw new Error(message);
    }
    throw message; // Fallback
  }
}

let global_state = {};

global_state.on_resize = (width, height) => {
  if ("litegraph_canvas" in global_state && global_state.litegraph)
    global_state.litegraph_canvas.resize(width, height);
};

function init_litegraph(json) {
  // Setup per window
  let random_string = "d8e605d156e5efb221c3198dcd4bcba2";
  if (!(random_string in window)) {
    let canvas =  document.getElementById("tmp_canvas");
    // window.GL.create({ canvas: canvas});
    global_state.litegraph = new LGraph();
    global_state.litegraph_canvas = new LGraphCanvas(canvas, global_state.litegraph);
    // global_state.litegraph_canvas = global_state.litegraph.canvas;
    global_state._selected_nodes = {};
    global_state.litegraph_canvas.onSelectionChange = (
      nodes
    ) => {
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
      global_state.exec_selected(new_selected);
      global_state.exec_deselected(new_deselected);
    };


    global_state.litegraph.start();


    global_state.litegraph_canvas.resize();
    LiteGraph.registerNodeType("gfx/PassNode", PassNode);
    LiteGraph.registerNodeType("gfx/BackBufferNode", BackBufferNode);
    LiteGraph.registerNodeType("gfx/DrawCallNode", DrawCallNode);
    LiteGraph.registerNodeType("gfx/PipelineNode", PipelineNode);
    LiteGraph.registerNodeType("gfx/VertexBufferNode", VertexBufferNode);
    LiteGraph.registerNodeType("gfx/ModelNode", ModelNode);
    LiteGraph.registerNodeType("gfx/TextureBufferNode", TextureBufferNode);
    LiteGraph.registerNodeType("gfx/FeedbackNode", FeedbackNode);
    LiteGraph.registerNodeType("gfx/FrameCountNode", FrameCountNode);
    window.addEventListener('message', event => {
      try {
        let json = JSON.parse(event.data);
        if ("type" in json) {
          if (json.type == "set(graph.json)") {
            let graph_json = JSON.parse(json.data);
            init_litegraph(graph_json);
          } else if (json.type == "get(graph.json)") {
            let json = global_state.litegraph.serialize();
            let str = JSON.stringify(json)
            let msg = {};
            msg.data = str;
            msg.type = "graph.json";
            if (window.parent != window)
              window.parent.postMessage(JSON.stringify(msg), '*');
          } else
            console.log("unrecoginez command type: " + json.type);
        } else
          console.log("unrecoginez command: " + event);
      } catch (e) {

      }


    });
    window[random_string] = true;
  }
  // global_state.litegraph.clear();
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
global_state.reload = () => {
  let json = global_state.litegraph.serialize();
  global_state.exec_reset();
  global_state.litegraph.configure(json, false);
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

  gl.disable(gl.CULL_FACE);
  gl.frontFace(gl.CW);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.SCISSOR_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  gl.deleteBuffer(positionBuffer);
  gl.deleteBuffer(colorBuffer);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  gl.deleteProgram(program);
};
global_state.render_texture = (tex, format, flipy) => {
  let gl = global_state.gl;
  flipy = flipy || false;
  var pipeline = {
    vs:
      `#version 300 es
      precision highp float;
      in vec2 position;
      out vec2 uv;
      void main() {
        uv = 0.5 * (position + 1.0);
        uv.y = 1.0 - uv.y;
        gl_Position = vec4(position, 0, 1);
      }
      `,
    ps:
      `#version 300 es
      precision highp float;
      precision highp int;
      precision highp usampler2D;
      precision highp isampler2D;
      in vec2 uv;
      uniform sampler2D in_tex;
      out vec4 fragColor;
      void main() {
        fragColor = vec4(vec3(texture(in_tex, uv).xyz), 1.0);
      }`,

  };
  if (flipy) {
    pipeline.vs = pipeline.vs.replace("uv.y = 1.0 - uv.y;", "uv.y = uv.y;");
  }
  if (format) {
    switch (format) {
      case "RGBA32UI": {
        pipeline.ps = pipeline.ps.replace("uniform sampler2D", "uniform usampler2D");
      }
        break;
      case "RGBA32F": {
      }
        break;
      default:
        throw Error("unknown format");
    }
  }
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
global_state.get_texture_data = (tex, format, width, height) => {
  let gl = global_state.gl;
  // create to render to
  const targetTextureWidth = Math.floor(width) || 256;
  const targetTextureHeight = Math.floor(height) || 256;
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

  global_state.render_texture(tex, format);

  var data = new Uint8Array(targetTextureWidth * targetTextureHeight * 4);
  gl.readPixels(0, 0, targetTextureWidth, targetTextureHeight, gl.RGBA, gl.UNSIGNED_BYTE, data);


  gl.deleteFramebuffer(fb);
  gl.deleteTexture(targetTexture);
  // console.log(targetTextureWidth);
  // console.log(targetTextureHeight);
  // console.log(targetTextureWidth * targetTextureHeight * 4);
  let array = new Uint8ClampedArray(data);
  let image = new ImageData(array, targetTextureWidth, targetTextureHeight);
  return image;
};
global_state._dirty_set = new Set();
global_state._dirty_deferred_set = new Set();
global_state.set_dirty = (node) => {
  // console.log(node + " is dirty!");
  if (node.is_recursive && node.is_recursive())
    global_state._dirty_deferred_set.add(node);
  else
    global_state._dirty_set.add(node);
};
global_state.update = () => {
  let set_to_check = new Set(global_state._dirty_set);
  while (true) {
    let new_set = new Set();
    set_to_check.forEach(node => {
      if (node.outputs)
        node.outputs.forEach(output => {
          if (!output.links)
            return;
          output.links.forEach(link_id => {
            let link = global_state.litegraph.links[link_id];
            // console.log("visiting link: " + link);
            let target = global_state.litegraph.getNodeById(link.target_id);
            if (target && !global_state._dirty_set.has(target)) {
              global_state._dirty_set.add(target);
              new_set.add(target);
            }
          });


        });
    });
    if (new_set.size == 0)
      break;
    set_to_check = new_set;
  }
  // console.log(global_state._dirty_set);
  let sorted_list = [];
  let backlog = new Set();
  var loop_counter = 0;
  while (true) {
    let to_remove = new Set();
    global_state._dirty_set.forEach(node => {
      let has_dirty_input = false;
      if (node.inputs)
        node.inputs.forEach(input => {
          if (input.link) {
            var input_node = global_state.litegraph.getNodeById(input.link.input_id);
            if (global_state._dirty_set.has(input_node))
              has_dirty_input = true;
          }
        });
      if (!has_dirty_input) {
        backlog.add(node);
        sorted_list.push(node);
      }
    });
    backlog.forEach(node => global_state._dirty_set.delete(node));
    backlog.clear();
    if (global_state._dirty_set.size == 0)
      break;
    loop_counter += 1;
    if (loop_counter > 1000)
      throw Error("[Error] Recursion detected. Exiting loop");
  }
  sorted_list.forEach(node => { if (node.update) node.update(); node.notify(); });
  global_state._dirty_deferred_set.forEach(node => { if (node.update) node.update(); });
  global_state._dirty_deferred_set.clear();
};
global_state.periodic_update = setInterval(global_state.update, 200);
global_state.toposort = () => {
  let sorted = [];
  let sorted_set = new Set();
  let unsorted_set = new Set();
  let unsorted = [];
  global_state.litegraph._nodes.forEach(node => {
    if (!node.is_recursive || !node.is_recursive()) {
      unsorted_set.add(node);
      unsorted.push(node);
    }
  });


  while (unsorted.length) {
    let node = unsorted.shift();
    var is_ready = true;
    for (let i in node.inputs) {
      let link_id = node.inputs[i].link;
      if (link_id) {
        var link_info = global_state.litegraph.links[link_id];
        if (link_info) {
          let target_node = global_state.litegraph.getNodeById(link_info.origin_id);
          if (unsorted_set.has(target_node)) {
            is_ready = false;
            break;
          }
        }
      }
    }
    if (is_ready) {
      sorted.push(node);
      sorted_set.add(node);
      unsorted_set.delete(node);
    } else {
      unsorted.push(node);
    }
  }
  global_state.litegraph._nodes.forEach(node => {
    if (node.is_recursive && node.is_recursive()) {
      // console.log(node);
      sorted.push(node);
    }
  });
  return sorted;
};
global_state.frame_count = 0;
global_state.draw = () => {
  let json_backup = global_state.litegraph.serialize();
  try {
    let sorted_nodes = global_state.toposort();
    sorted_nodes.forEach(node => { if (node.is_valid() && node.gl_init) node.gl_init(global_state.gl) });
    sorted_nodes.forEach(node => { if (node.is_valid() && node.gl_render) node.gl_render(global_state.gl) });
    Array.from(sorted_nodes).reverse().forEach(node => { if (node.is_valid() && node.gl_release) node.gl_release(global_state.gl) });
    global_state.litegraph_canvas.setDirty(true);
    global_state.frame_count += 1;
  } catch (e) {
    console.log(e);
    console.log("the emergency copy of the graph is dumped");
    console.log(JSON.stringify(json_backup));
  }
  // global_state.periodic_draw = setTimeout(global_state.draw, 100);
};
global_state.update_thumbnails = () => {
  global_state.litegraph_canvas.setDirty(true);
};
// TODO:
// * drawcall node
//   * input attribute stream
//      * per vertex/instance
//   * input uniform hvalues(matrices, vector, float, ints, textures+texture sizes)
// * value nodes
//   * camera node(generates look,up,left vectors and view/projection/inverse matrices)
// * update propagation?

let graph_list = [
  'examples/default_graph.json',
  'examples/disjoint_test.json',
  'examples/multipass_test.json',
  'examples/ltc.json',
  'examples/feedback_test.json'
];
global_state.load_graph = (url) => {
  fetch(url)
    .then(response => response.text())
    .then(text => {
      try {
        init_litegraph(JSON.parse(text));
      } catch (e) {
        console.log(e);
      }
    });
};

class LoadGraphButton extends React.Component {
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
          Load Graph
      </Button>

        <Modal show={this.state.visible} onHide={this.handleClose}>
          <Modal.Header closeButton>
            <Modal.Title>Choose source</Modal.Title>
          </Modal.Header>
          <Modal.Footer>
            <Button variant="secondary" onClick={this.handleClose}>
              Cancel
          </Button>
            <DropdownButton id="dropdown-item-button" title="Dropdown button">
              {graph_list.map(
                variant => (
                  <Dropdown.Item key={variant} onClick={() => {
                    fetch(variant)
                      .then(response => response.text())
                      .then(text => {
                        init_litegraph(JSON.parse(text));
                      });

                  }}>{variant}</Dropdown.Item>
                ),
              )}

            </DropdownButton>
          </Modal.Footer>
        </Modal>
      </>
    );
  }
}

var gltf_loader = new GLTFLoader();

class MyLGraphNode extends LGraphNode {
  constructor() {
    super();
    this.subscribers = new Set();
  }
  is_recursive = () => false;
  subscribe = (node) => { this.subscribers.add(node) }
  unsubscribe = (node) => { this.subscribers.delete(node) }
  notify = () => { this.subscribers.forEach(node => { if (node.set_dirty) node.set_dirty() }) }
  set_dirty = () => { global_state.set_dirty(this); }
  onConfigure = () => { if (this.update) this.set_dirty(); }
  clean_inputs = () => {
    let len = this.inputs.length;
    for (let i = len - 1; i >= 0; i--) {
      this.removeInput(i);
    }
  }
  clean_outputs = () => {
    let len = this.outputs.length;
    for (let i = len - 1; i >= 0; i--) {
      this.removeOutput(i);
    }
  }
  onRemoved = () => {
    global_state._dirty_set.delete(this);
  }
  set_inputs = (new_outputs) => {
    let last_attributes = new Set();
    this.inputs.forEach(input => last_attributes.add(input.type + " " + input.name));
    if (!isSetsEqual(last_attributes, new_outputs)) {
      last_attributes.forEach(attr => { if (!new_outputs.has(attr)) { this.removeInputByName(attr.split(" ")[1]) } });
      new_outputs.forEach(attr => {
        if (!last_attributes.has(attr)) {
          this.addInput(attr.split(" ")[1], attr.split(" ")[0])
        }
      });
    }
  }
  set_outputs = (new_outputs) => {
    let last_attributes = new Set();
    this.outputs.forEach(input => last_attributes.add(input.type + " " + input.name));
    if (!isSetsEqual(last_attributes, new_outputs)) {
      last_attributes.forEach(attr => { if (!new_outputs.has(attr)) { this.removeOutputByName(attr.split(" ")[1]) } });
      new_outputs.forEach(attr => {
        if (!last_attributes.has(attr)) {
          this.addOutput(attr.split(" ")[1], attr.split(" ")[0])
        }
      });
    }
  }
  is_valid = () => {
    return true;
  }
}

class FrameCountNode extends MyLGraphNode {
  constructor() {
    super();
    this.title = "Frame count";

    this.addWidget("button", "reset", null, (v) => { global_state.frame_count = 0; }, {});
    this.addOutput("0", "uniform_t");
  }
  get_value = (slot) => {
    return global_state.frame_count;
  }
  onDrawBackground = (ctx) => {
    if (global_state.frame_count == 0)
      this.outputs[0].label = "0";
    else
      this.outputs[0].label = global_state.frame_count;
  }
}

class Mesh {
  init = (attributes, indices) => {
    this.attributes = attributes;
    this.indices = indices;
  }

  init_gltf = (mesh) => {
    assert(mesh.type == "Mesh");
    BufferGeometryUtils.computeTangents(mesh.geometry);
    this.attributes = {};
    Object.keys(mesh.geometry.attributes).forEach(attr_name => {
      let raw_attr = mesh.geometry.attributes[attr_name];
      let attr = {};
      attr.data = raw_attr.array;
      assert(raw_attr.normalized == false);
      switch (raw_attr.itemSize) {
        case 1: attr.type = "float"; break;
        case 2: attr.type = "vec2"; break;
        case 3: attr.type = "vec3"; break;
        case 4: attr.type = "vec4"; break;
        default: throw Error();
      }
      this.attributes[attr_name] = attr;
    });
    this.indices = {};
    this.indices.data = mesh.geometry.index.array;
    this.indices.type = "uint16";
    this.pbr_material = mesh.material;
    this.images = [];
    Object.keys(this.pbr_material).forEach(field => {
      if (
        this.pbr_material[field] &&
        typeof (this.pbr_material[field]) == "object" &&
        "image" in this.pbr_material[field]) {
        this.images.push({ name: field, img: this.pbr_material[field].image });
      }
    });

    // console.log(mesh.geometry);
  }

  get_attrib_data = (name) => {
    return this.attributes[name];
  }

  get_index_data = () => {
    return this.indices;
  }
}

class ModelNode extends MyLGraphNode {
  constructor() {
    super();
    this.title = "Model";
    this.properties = {
      fileurl: null,
    };
    this.onPropertyChange = (prop, val) => {
      if (prop == "fileurl") {

      }
    };
    this.addOutput("mesh", "mesh_t");
    this.meshes = [];
    // let url = 'models/gltf/dieselpunk_hovercraft/scene.gltf';
    let url = 'models/LeePerrySmith/LeePerrySmith.gltf';
    gltf_loader.load(url, (gltf) => {
      console.log(gltf);
      this.gltf = gltf;
      this.traverse(gltf.scene);
    });
    this.yoffset = 0;
  }

  traverse = (node) => {
    if (node.type == "Mesh") {
      let mesh = new Mesh();
      mesh.init_gltf(node);
      this.meshes.push(mesh);
    } else {
      node.children.forEach(child => this.traverse(child));
    }
  }

  get_meshes = () => {
    return this.meshes;
  }

  onDrawBackground(ctx) {
    if (this.flags.collapsed) {
      return;
    }
  }

  display = (propnode) => {
    var canvas1 = document.createElement("canvas");
    var canvas2 = document.createElement("canvas");
    var div = document.createElement("div");
    div.appendChild(canvas1);
    div.style.cssText = "margin-top: 16px;";
    {
      var context = canvas1.getContext('webgl2', { alpha: false });
      var renderer = new THREE.WebGLRenderer({ canvas: canvas1, context: context });
      var controls;
      var camera, scene;
      camera = new THREE.PerspectiveCamera(45, 1.0, 0.25, 20);
      camera.position.set(- 1.8, 0.6, 2.7);

      scene = new THREE.Scene();
      var render = function () {
        let parent = propnode.datgui.domElement.parentNode;
        if (parent) {
          canvas1.classList.add('margin_16');
          renderer.setSize(parent.offsetWidth - 32, parent.offsetWidth - 32);
        }
        else
          renderer.setSize(512, 512);
        renderer.render(scene, camera);
      };
      var pmremGenerator = new THREE.PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();
      new RGBELoader()
        .setDataType(THREE.UnsignedByteType)
        .setPath('textures/equirectangular/')
        .load('venice_sunset_1k.hdr', (texture) => {

          var envMap = pmremGenerator.fromEquirectangular(texture).texture;

          scene.background = envMap;
          scene.environment = envMap;

          texture.dispose();
          pmremGenerator.dispose();
          scene.add(this.gltf.scene);

          render();

        });

      renderer.setPixelRatio(1.0);

      renderer.outputEncoding = THREE.sRGBEncoding;

      let offset = 1.25;
      const boundingBox = new THREE.Box3();
      boundingBox.setFromObject(this.gltf.scene);
      const size = boundingBox.getSize();
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / 4 * Math.tan(fov * 2));
      cameraZ *= offset;
      // camera.position.z = cameraZ;
      const minZ = boundingBox.min.z;
      const cameraToFarEdge = (minZ < 0) ? -minZ + cameraZ : cameraZ - minZ;

      controls = new OrbitControls(camera, renderer.domElement);
      controls.addEventListener('change', render);
      controls.minDistance = maxDim;
      controls.maxDistance = 1000;
      controls.target.set(0, 0, 0);
      controls.update();

      camera.aspect = 1.0;
      camera.far = 1000;
      camera.far = cameraToFarEdge * 3;

      camera.updateProjectionMatrix();


      renderer.render(scene, camera);
    }
    div.appendChild(canvas2);

    // let folder = propnode.datgui.addFolder("Attributes");
    // for (let i in this.attributes) {
    //   let tmp = {
    //     prop: () => { },
    //   };
    //   folder.add(tmp, "prop").name(i);
    // }
    // folder.open();
    propnode.datgui.domElement.appendChild(div);
    div.width = 512;
    // {
    //   let ctx = canvas2.getContext("2d");
    //   var yoffset = 0;
    //   var xoffset = 64;
    //   var border = 16;
    //   var size = 256;
    //   canvas2.width = xoffset + size;
    //   var height = 0;
    //   var images = [];
    //   Object.keys(this.pbr_material).forEach(field => {
    //     if (
    //       this.pbr_material[field] &&
    //       typeof (this.pbr_material[field]) == "object" &&
    //       "image" in this.pbr_material[field]) {
    //       images.push({ name: field, img: this.pbr_material[field].image });
    //       height += size + border;
    //     }
    //   });
    //   canvas2.height = height;
    //   div.height = height + 256;

    //   images.forEach(img => {
    //     ctx.fillStyle = "white";
    //     ctx.fillText(img.name, 0, yoffset + 16);
    //     ctx.drawImage(
    //       img.img
    //       , xoffset, yoffset, size, size);
    //     yoffset += size + border;
    //   });
    // }
  }
}

class GLComponent extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.graph = new LGraph();
    this.canvas = null;
  }

  componentDidMount() {
    this.canvas = document.getElementById("myglcanvas");
    this.gl = this.canvas.getContext('webgl2', { alpha: false });

    // return;
    let gl = this.gl;
    const ext = gl.getExtension('EXT_color_buffer_float');
    if (!ext) {
      return alert('need EXT_color_buffer_float');
    }
    // console.log(ext);
    global_state.glcanvas = this.canvas;
    global_state.gl = gl;
    global_state.draw_triangle(gl);
  }

  exec_graph = () => {

  }

  onResize = () => {
    this.canvas.width = this.canvas.parentNode.offsetWidth;
    this.canvas.height = this.canvas.parentNode.offsetHeight;
    // this.canvas.resize();
  }

  render() {

    return (
      <canvas id='myglcanvas' style={{ width: '100%', height: '100%' }}></canvas>

    );
  }
}

class BackBufferNode extends MyLGraphNode {
  constructor() {
    super();
    this.addInput("in", "uniform_t");
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
    this.thumbnail = null;
    this.viewport = { width: 128, height: 128 };
    // this.button = this.addWidget("button", "draw", null, (v) => { this.draw(); }, {});
  }
  gl_render = (gl) => {
    let in_node = this.getInputNodeByName("in");
    if (!in_node)
      return;
    let input_link = this.getInputLinkByName("in");
    let tex = in_node.get_texture(input_link.origin_slot);
    this.update_thumbnails();
    let canvas = global_state.glcanvas;
    var displayWidth = canvas.clientWidth;
    var displayHeight = canvas.clientHeight;

    if (displayWidth && displayHeight) {
      if (canvas.width != displayWidth ||
        canvas.height != displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
      }
    }
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.SCISSOR_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.blendFunc(gl.ONE, gl.ONE);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.drawBuffers([gl.BACK]);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    global_state.render_texture(tex, "RGBA32F", true);
  }

  update_thumbnails = () => {
    let in_node = this.getInputNodeByName("in");
    if (!in_node)
      return;
    let input_link = this.getInputLinkByName("in");
    let tex = in_node.get_texture(input_link.origin_slot);
    this.thumbnail = null;
    let image_data = global_state.get_texture_data(tex, "RGBA32F",
      this.viewport.width, this.viewport.height);
    let tmp_canvas = document.createElement("canvas");
    let tmp_canvasContext = tmp_canvas.getContext("2d");
    tmp_canvas.width = image_data.width;
    tmp_canvas.height = image_data.height;
    tmp_canvasContext.putImageData(image_data, 0, 0);
    var img = document.createElement("img");
    img.src = tmp_canvas.toDataURL("image/png");
    this.thumbnail = img;
    global_state.update_thumbnails();
  }

  onDrawBackground(ctx) {
    if (this.flags.collapsed) {
      return;
    }
    var yoffset = 16;
    var xoffset = 16;
    var border = 16;
    var size = this.size[0] - border * 2;
    this.viewport.width = size;
    this.viewport.height = size;

    if (this.thumbnail) {
      ctx.drawImage(this.thumbnail, xoffset, yoffset, size, size);
    } else {
      ctx.fillRect(xoffset, yoffset, size, size);
    }
    this.size[1] = size + border * 2;

  }
}

class PipelineNode extends MyLGraphNode {
  constructor() {
    super();

    this.properties = {
      vs: null,
      ps: null,
      depth_state: {
        enable: true,
        func: "LEQUAL",
        write: true
      },
      blend_state: {
        enable: false,
        dst_rgb: "ZERO",
        src_rgb: "ONE",
        dst_alpha: "ZERO",
        src_alpha: "ONE",
        func_rgb: "FUNC_ADD",
        func_alpha: "FUNC_ADD",
      },
      // @TODO: Stencil state
      // stencil_state: {
      //   enable: false,
      //   func: "ALWAYS",
      //   fail: "KEEP",
      //   pass_depth_fail: "KEEP",
      //   pass_depth_pass: "KEEP",
      //   ref: 0x0,
      //   value_mask: 0xff,
      //   writemask: 0xff,
      //   back_func: "ALWAYS",
      //   back_fail: "KEEP",
      //   back_pass_depth_fail: "KEEP",
      //   back_pass_depth_pass: "KEEP",
      //   back_ref: 0x0,
      //   back_value_mask: 0xff,
      //   back_writemask: 0xff
      // },
      cull_state: {
        enable: false,
        face_mode: "BACK",
        front_face: "CCW"
      },
      cache: {
        attributes: null,
        uniforms: null
      }
    };
    this.addOutput("out", "pipeline_t");
    this.title = "Pipeline";
    this.valid = false;
    global_state.exec_after('remove_src', (cmd) => {
      if (cmd.src_name == this.vs) {
        this.set_vs(null);
      }
      if (cmd.src_name == this.ps) {
        this.set_ps(null);
      }
    });
    global_state.on_src_change((src_name) => {
      // console.log("pipeline has received an update on " + src_name);
      if (src_name == this.properties.vs) {
        this.set_dirty();
      }
      if (src_name == this.properties.ps) {
        this.set_dirty();
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
    return this.valid;
  }

  get_uniform_location = (gl, name) => {
    return gl.getUniformLocation(this.gl.program, name);
  }

  gl_init = (gl) => {
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
      this.gl_release(gl);
      return false;
    }

    let ps_source = global_state.get_src(this.properties.ps);
    this.gl.ps = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(this.gl.ps, ps_source);
    gl.compileShader(this.gl.ps);

    if (!gl.getShaderParameter(this.gl.ps, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(this.gl.ps));
      this.gl_release(gl);
      return false;
    }

    this.gl.program = gl.createProgram();
    gl.attachShader(this.gl.program, this.gl.ps);
    gl.attachShader(this.gl.program, this.gl.vs);
    gl.linkProgram(this.gl.program);

    if (!gl.getProgramParameter(this.gl.program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(this.gl.program));
      this.gl_release(gl);
      return false;
    }
  }

  bind = (gl) => {
    gl.useProgram(this.gl.program);
    if ("cull_state" in this.properties) {
      let cull_state = this.properties.cull_state;
      if (cull_state.enable)
        gl.enable(gl.CULL_FACE);
      else
        gl.disable(gl.CULL_FACE);
      let front_face_map = {
        "CW": gl.CW,
        "CCW": gl.CCW
      };
      let cull_mode_map = {
        "FRONT": gl.FRONT, "BACK": gl.BACK, "FRONT_AND_BACK": gl.FRONT_AND_BACK
      };

      gl.frontFace(front_face_map[cull_state.front_face]);
      gl.cullFace(cull_mode_map[cull_state.face_mode]);
    } else {
      gl.disable(gl.CULL_FACE);
    }
    if ("blend_state" in this.properties) {
      let blend_map = {
        "ZERO": gl.ZERO, "ONE": gl.ONE, "SRC_COLOR": gl.SRC_COLOR,
        "ONE_MINUS_SRC_COLOR": gl.ONE_MINUS_SRC_COLOR, "DST_COLOR": gl.DST_COLOR,
        "ONE_MINUS_DST_COLOR": gl.ONE_MINUS_DST_COLOR, "SRC_ALPHA": gl.SRC_ALPHA,
        "ONE_MINUS_SRC_ALPHA": gl.ONE_MINUS_SRC_ALPHA, "DST_ALPHA": gl.DST_ALPHA,
        "ONE_MINUS_DST_ALPHA": gl.ONE_MINUS_DST_ALPHA, "CONSTANT_COLOR": gl.CONSTANT_COLOR,
        "ONE_MINUS_CONSTANT_COLOR": gl.ONE_MINUS_CONSTANT_COLOR,
        "CONSTANT_ALPHA": gl.CONSTANT_ALPHA,
        "ONE_MINUS_CONSTANT_ALPHA": gl.ONE_MINUS_CONSTANT_ALPHA,
        "SRC_ALPHA_SATURATE": gl.SRC_ALPHA_SATURATE
      };
      let blend_state = this.properties.blend_state;
      if (blend_state.enable)
        gl.enable(gl.BLEND);
      else
        gl.disable(gl.BLEND);

      const srcRGBFunc = blend_map[blend_state.src_rgb];
      const dstRGBFunc = blend_map[blend_state.dst_rgb];
      const srcAlphaFunc = blend_map[blend_state.dst_alpha];
      const dstAlphaFunc = blend_map[blend_state.src_alpha];

      gl.blendFuncSeparate(
        srcRGBFunc, dstRGBFunc, srcAlphaFunc, dstAlphaFunc);

      let blend_funcs = {
        "FUNC_ADD": gl.FUNC_ADD,
        "FUNC_SUBTRACT": gl.FUNC_SUBTRACT, "FUNC_REVERSE_SUBTRACT": gl.FUNC_REVERSE_SUBTRACT
      };
      const rgbEquation = blend_funcs[blend_state.func_rgb];
      const alphaEquation = blend_funcs[blend_state.func_alpha];
      gl.blendEquationSeparate(rgbEquation, alphaEquation);
    } else {
      gl.disable(gl.BLEND);
    }

    let cmp_table = {
      "NEVER": gl.NEVER, "LESS": gl.LESS, "EQUAL": gl.EQUAL, "LEQUAL": gl.LEQUAL,
      "GREATER": gl.GREATER, "NOTEQUAL": gl.NOTEQUAL, "GEQUAL": gl.GEQUAL, "ALWAYS": gl.ALWAYS
    };

    if ("depth_state" in this.properties) {
      let depth_state = this.properties.depth_state;
      if (depth_state.enable)
        gl.enable(gl.DEPTH_TEST);
      else
        gl.disable(gl.DEPTH_TEST);
      gl.depthMask(depth_state.write);
      gl.depthFunc(cmp_table[depth_state.func]);
    }

    gl.disable(gl.SCISSOR_TEST);
    // @TODO: Stencil state
    gl.disable(gl.STENCIL_TEST);

    return true;
  }

  get_attrib_location = (gl, name) => {
    if (!this.gl || !this.gl.program)
      return null;
    return gl.getAttribLocation(this.gl.program, name);
  }

  gl_release = (gl) => {
    if (!("gl" in this))
      return;
    if (this.gl.vs != null) gl.deleteShader(this.gl.vs);
    if (this.gl.ps != null) gl.deleteShader(this.gl.ps);
    if (this.gl.program != null) gl.deleteProgram(this.gl.program);
    delete this.gl;
  }

  display = (propnode) => {

    let src_list = [];
    let datgui_state = {
      select_vs: this.properties.vs,
      select_ps: this.properties.ps,
    };

    /*
    str = {};
    let arr = ;
    for (let i in arr) {
    str+="\"" + arr[i] + "\": gl." + arr[i] + ",";
    }
    */

    let depth_cmps = ["NEVER", "LESS", "EQUAL", "LEQUAL", "GREATER", "NOTEQUAL", "GEQUAL", "ALWAYS"];
    Object.keys(global_state.litegraph.config.srcs).forEach(e => src_list.push(e));
    propnode.datgui.add(datgui_state, 'select_vs', src_list)
      .onChange((v) => this.set_vs(v));
    propnode.datgui.add(datgui_state, 'select_ps', src_list)
      .onChange((v) => this.set_ps(v));
    let depth_state = propnode.datgui.addFolder("Depth state");
    depth_state.add(this.properties.depth_state, 'enable');
    depth_state.add(this.properties.depth_state, 'write');
    depth_state.add(this.properties.depth_state, 'func', depth_cmps);
    depth_state.open();

    let blend_ops = ["ZERO", "ONE", "SRC_COLOR", "ONE_MINUS_SRC_COLOR",
      "DST_COLOR", "ONE_MINUS_DST_COLOR", "SRC_ALPHA", "ONE_MINUS_SRC_ALPHA",
      "DST_ALPHA", "ONE_MINUS_DST_ALPHA", "CONSTANT_COLOR", "ONE_MINUS_CONSTANT_COLOR",
      "CONSTANT_ALPHA", "ONE_MINUS_CONSTANT_ALPHA", "SRC_ALPHA_SATURATE"];

    let blend_funcs = ["FUNC_ADD", "FUNC_SUBTRACT", "FUNC_REVERSE_SUBTRACT"];

    let blend_state = propnode.datgui.addFolder("Blend state");
    blend_state.add(this.properties.blend_state, 'enable');
    blend_state.add(this.properties.blend_state, 'dst_rgb', blend_ops);
    blend_state.add(this.properties.blend_state, 'src_rgb', blend_ops);
    blend_state.add(this.properties.blend_state, 'dst_alpha', blend_ops);
    blend_state.add(this.properties.blend_state, 'src_alpha', blend_ops);
    blend_state.add(this.properties.blend_state, 'func_rgb', blend_funcs);
    blend_state.add(this.properties.blend_state, 'func_alpha', blend_funcs);
    blend_state.open();

    let cull_state = propnode.datgui.addFolder("Cull state");
    cull_state.add(this.properties.cull_state, 'enable');
    cull_state.add(this.properties.cull_state, 'face_mode', ["FRONT", "BACK", "FRONT_AND_BACK"]);
    cull_state.add(this.properties.cull_state, 'front_face', ["CW", "CCW"]);
    cull_state.open();

    // let stencil_state = propnode.datgui.addFolder("Stencil state");
    // let stencil_ops = ["KEEP", "ZERO", "REPLACE", "INCR", "INCR_WRAP", "DECR", "DECR_WRAP", "INVERT"];
    // stencil_state.add(this.properties.stencil_state, 'enable');
    // stencil_state.add(this.properties.stencil_state, 'func', depth_cmps);
    // stencil_state.add(this.properties.stencil_state, 'fail', stencil_ops);
    // stencil_state.add(this.properties.stencil_state, 'pass_depth_fail', stencil_ops);
    // stencil_state.add(this.properties.stencil_state, 'pass_depth_pass', stencil_ops);
    // stencil_state.add(this.properties.stencil_state, 'ref');
    // stencil_state.add(this.properties.stencil_state, 'value_mask');
    // stencil_state.add(this.properties.stencil_state, 'writemask');
    // stencil_state.add(this.properties.stencil_state, 'back_func', depth_cmps);
    // stencil_state.add(this.properties.stencil_state, 'back_fail', stencil_ops);
    // stencil_state.add(this.properties.stencil_state, 'back_pass_depth_fail', stencil_ops);
    // stencil_state.add(this.properties.stencil_state, 'back_pass_depth_pass', stencil_ops);
    // stencil_state.add(this.properties.stencil_state, 'back_ref');
    // stencil_state.add(this.properties.stencil_state, 'back_value_mask');
    // stencil_state.add(this.properties.stencil_state, 'back_writemask');
    // stencil_state.open();
  }

  update = () => {
    this.parse_shaders();
  }

  get_info = () => {
    if (!this.valid)
      this.parse_shaders();
    return {
      attributes: this.properties.cache.attributes, uniforms:
        this.properties.cache.uniforms, valid: this.valid
    };
  }

  parse_shaders = () => {
    // this.clean_inputs();
    this.valid = false;
    let uniform_set = new Set();

    this.properties.cache.attributes = [];
    this.properties.cache.uniforms = [];
    if (this.properties.vs != null) {
      try {
        // Parse vertex shader for attributes
        if (typeof window.glslang == "undefined")
          throw Error("glslang is not ready");
        let str = window.glslang.parse_attributes(global_state.get_src(this.properties.vs),
          "vertex");
        let json = JSON.parse(str);
        // console.log(str);
        for (var i = 0; i < json.attributes.length - 1; i++) {
          let attrib = json.attributes[i];
          this.properties.cache.attributes.push({ name: attrib.name, type: attrib.type });
        }
        for (var i = 0; i < json.uniforms.length - 1; i++) {
          let uniform = json.uniforms[i];
          if (uniform_set.has(uniform.name))
            continue;
          // names starting with '_' are builtins
          if (uniform.name[0] == "_")
            continue;
          uniform_set.add(uniform.name);
          this.properties.cache.uniforms.push({ name: uniform.name, type: uniform.type });
        }
        // ps uniform parsing
        {
          let str = window.glslang.parse_attributes(global_state.get_src(this.properties.ps),
            "fragment");
          let json = JSON.parse(str);
          // console.log(str);
          for (var i = 0; i < json.uniforms.length - 1; i++) {
            let uniform = json.uniforms[i];
            if (uniform_set.has(uniform.name))
              continue;
            // names starting with '_' are builtins
            if (uniform.name[0] == "_")
              continue;
            uniform_set.add(uniform.name);
            this.properties.cache.uniforms.push({ name: uniform.name, type: uniform.type });
          }
        }
        this.valid = true;
      } catch (e) {
        console.log(e);
        return null;
      }
    }
  }

  onSelected() {
  }

  onDeselected() {
  }

}

class VertexBufferNode extends MyLGraphNode {
  constructor() {
    super();
    this.title = "Vertex Buffer";
    this.properties = {
      src: null
    };
    global_state.on_src_change((src_name) => {
      if (src_name == this.properties.src) {
        this.set_dirty();
      }
    });
    global_state.exec_after('remove_src', (cmd) => {
      if (cmd.src_name == this.properties.src) {
        this.set_src(null);
      }
    });
    this.buf = { attributes: {} };
    this.set_dirty();
    this.addOutput("mesh", "mesh_t");
  }

  display = (propnode) => {
    let src_list = [];
    let datgui_state = {
      src: this.properties.src,
    };
    Object.keys(global_state.litegraph.config.srcs).forEach(e => src_list.push(e));
    propnode.datgui.add(datgui_state, 'src', src_list)
      .onChange((v) => this.set_src(v));
    let folder = propnode.datgui.addFolder("Attributes");
    if (this.buf) {
      for (let i in this.buf.attributes) {
        let tmp = {
          prop: () => { },
        };
        folder.add(tmp, "prop").name(i);
      }
    }
    folder.open();
  }

  set_src = (name) => {
    this.properties.src = name;
    this.set_dirty();
  }

  get_meshes = () => {
    return [this.mesh];
  }

  parse_src = () => {
    if (!this.properties.src) {
      return;
    }
    let text = global_state.get_src(this.properties.src);
    if (!text) {
      this.properties.src = null;
      return;
    }
    try {
      let json = JSON.parse(text);
      assert(json);
      assert(json.attributes);
      let mesh = new Mesh();
      mesh.init(json.attributes, json.indices);
      this.mesh = mesh;
    } catch (e) {
      console.log(e);
      this.mesh = null;
    }
  }

  update = () => {
    this.parse_src();
  }
}

class TextureBufferNode extends MyLGraphNode {
  constructor() {
    super();
    this.title = "Texture Buffer";
    this.properties = {
      src: null
    };
    global_state.on_src_change((src_name) => {
      if (src_name == this.properties.src) {
        this.set_dirty();
      }
    });
    global_state.exec_after('remove_src', (cmd) => {
      if (cmd.src_name == this.properties.src) {
        this.set_src(null);
      }
    });
    this.buf = {};
    this.thumbnail = null;
    this.set_dirty();
  }

  display = (propnode) => {
    let src_list = [];
    let datgui_state = {
      src: this.properties.src,
    };
    Object.keys(global_state.litegraph.config.srcs).forEach(e => src_list.push(e));
    propnode.datgui.add(datgui_state, 'src', src_list)
      .onChange((v) => this.set_src(v));
  }

  set_src = (name) => {
    this.properties.src = name;
    this.set_dirty();
  }

  get_buffer = (slot) => {
    return this.buf;
  }

  parse_src = () => {
    if (!this.properties.src) {
      this.clean_outputs();
      return;
    }
    let text = global_state.get_src(this.properties.src);
    if (!text) {
      this.properties.src = null;
      this.clean_outputs();
      return;
    }
    try {
      let json = JSON.parse(text);
      assert(json);
      assert(json.data && json.format && json.width && json.height);
      let new_outputs = new Set();
      new_outputs.add("uniform_t texture");
      this.set_outputs(new_outputs);
      this.buf = json;
    } catch (e) {
      console.error("Error while parsing json");
      console.error(e);
    }
  }

  get_texture = (loc) => {
    return this.gl.texture;
  }

  is_valid = () => {
    return this.properties.src != null;
  }

  gl_init = (gl) => {
    var texture = gl.createTexture();
    this.gl = {};
    this.gl.texture = texture;
    gl.bindTexture(gl.TEXTURE_2D, texture);

    const level = 0;
    var internalFormat = gl.RGBA32F;
    const width = this.buf.width;
    const height = this.buf.height;
    const border = 0;
    var format = gl.RGBA;
    var type = gl.FLOAT;
    var data = null;
    switch (this.buf.format) {
      case "RGBA32F": {
        type = gl.FLOAT;
        internalFormat = gl.RGBA32F;
        format = gl.RGBA;
        data = new Float32Array(this.buf.data);
      }
        break;
      case "RGBA32UI": {
        type = gl.UNSIGNED_INT;
        internalFormat = gl.RGBA32UI;
        format = gl.RGBA_INTEGER;
        data = new Uint32Array(this.buf.data);
      }
        break;
      default: throw Error(`Unsupported format ${this.buf.format}. Please add!`);
    };
    // console.log(data);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border,
      format, type, data);

    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, 0);
    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, Math.log2(width));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // gl.generateMipmap(gl.TEXTURE_2D);

  }

  gl_release = (gl) => {
    if (this.gl && this.gl.texture)
      gl.deleteTexture(this.gl.texture);
    delete this.gl;
  }

  update = () => {
    this.parse_src();
    this.update_thumbnails(global_state.gl);
  }

  update_thumbnails = (gl) => {
    this.thumbnail = null;
    if (!this.buf.data)
      return;
    this.gl_init(gl);
    let image_data = global_state.get_texture_data(this.gl.texture, this.buf.format);
    this.gl_release(gl);
    let tmp_canvas = document.createElement("canvas");
    let tmp_canvasContext = tmp_canvas.getContext("2d");
    tmp_canvas.width = image_data.width;
    tmp_canvas.height = image_data.height;
    tmp_canvasContext.putImageData(image_data, 0, 0);
    var img = document.createElement("img");
    img.src = tmp_canvas.toDataURL("image/png");
    this.thumbnail = img;
    global_state.update_thumbnails();
  }

  onDrawBackground(ctx) {
    if (this.flags.collapsed) {
      return;
    }
    var yoffset = 16;
    var xoffset = 16;
    var border = 16;
    var size = this.size[0] - border * 2;
    if (this.thumbnail) {
      ctx.drawImage(this.thumbnail, xoffset, yoffset, size, size);
    } else {
      ctx.fillRect(xoffset, yoffset, size, size);
    }
    this.size[1] = size + border * 2;
  }

}

class DrawCallNode extends MyLGraphNode {
  constructor() {
    super();
    this.addOutput("out", "drawcall_t");
    this.addInput("pipeline", "pipeline_t");
    this.addInput("mesh", "mesh_t");
    this.title = "Draw Call";
    this.attributes = [];
    this.uniforms = [];
    this.onConnectionsChange = (c_type, target_slot, flag, link_info, input) => {
      // if (input.type == "pipeline_t") {
      this.set_dirty();
      // } else {
      // return false;
      // }
    };
    // this.onConnectInput = (target_slot, output_type, output) => {
    //   if (output_type == "pipeline_t") {
    //     return true;
    //   } else {
    //     if ()
    //     return false;
    //   }
    // };
  }

  update_inputs = () => {
    let pipeline = this.getInputNodeByName("pipeline");
    var sat = new Set();

    if (pipeline) {
      let pipeline_info = pipeline.get_info();
      if (!pipeline_info.valid)
        return;
      this.attributes = pipeline_info.attributes;
      this.uniforms = pipeline_info.uniforms;
      this.uniforms.forEach(a => sat.add("uniform_t " + a.name));
      if (this.properties.default_uniforms) {
        let to_remove = [];
        Object.keys(this.properties.default_uniforms).forEach(uni_name => {
          if (!sat.has("uniform_t " + uni_name))
            to_remove.push(uni_name);
        });
        to_remove.forEach(uni_name => {
          console.log("[INFO] Found stale default value for " + uni_name);
          delete this.properties.default_uniforms[uni_name]
        }
        );
      }
    }
    sat.add("pipeline_t pipeline");
    sat.add("mesh_t mesh");
    this.set_inputs(sat);
  }

  is_valid = () => {
    let pipeline = this.getInputNodeByName("pipeline");
    if (pipeline == null || !pipeline.is_valid())
      return false;
    let mesh_input = this.getInputNodeByName("mesh");
    if (mesh_input == null || !mesh_input.is_valid())
      return false;
    return true;
  }

  gl_init = (gl) => {
    let pipeline = this.getInputNodeByName("pipeline");
    let mesh_input = this.getInputNodeByName("mesh");
    assert(mesh_input && pipeline);
    this.gl = {};
    this.gl.arrays = [];
    this.gl.buffers = [];
    let meshes = mesh_input.get_meshes();
    meshes.forEach(mesh => {
      let arr = gl.createVertexArray();
      this.gl.arrays.push(arr);
      gl.bindVertexArray(arr);

      for (let i in this.attributes) {
        let attrib = this.attributes[i];
        let out_attrib = mesh.get_attrib_data(attrib.name);
        if (!out_attrib)
          continue;
        assert(out_attrib.type == attrib.type);
        let data = out_attrib.data;
        var gl_buffer = gl.createBuffer();
        this.gl.buffers.push(gl_buffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
        let loc = pipeline.get_attrib_location(gl, attrib.name);
        if (loc < 0)
          continue;
        var comps = -1;
        switch (attrib.type) {
          case "vec2":
            comps = 2;
            break;
          case "vec3":
            comps = 3;
            break;
          default:
            throw Error("unrecognized type");
        };
        gl.vertexAttribPointer(loc, comps, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(loc);
      }
      arr.draw_size = 3;
      {
        let buf = mesh.get_index_data();
        assert("data" in buf);
        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        this.gl.buffers.push(indexBuffer);
        assert(buf.type == "uint16");
        gl.bufferData(
          gl.ELEMENT_ARRAY_BUFFER,
          new Uint16Array(buf.data),
          gl.STATIC_DRAW
        );
        arr.draw_size = buf.data.length;

      }
      arr.index_type = gl.UNSIGNED_SHORT;
    });
  }

  display = (propnode) => {
    if (this.uniforms) {
      let datgui_state = {
      };
      let new_rt = propnode.datgui.addFolder("Uniforms");
      let add_vec = (name, comps) => {
        let strs = [".x", ".y", ".z", ".w"];
        if (!("default_uniforms" in this.properties)) {
          this.properties["default_uniforms"] = {};
        }
        if (!(name in this.properties.default_uniforms)) {
          this.properties.default_uniforms[name] = [];
        }
        if (this.properties.default_uniforms[name].length != comps) {
          this.properties.default_uniforms[name] = new Array(comps).fill(0.0);;
        }
        for (var i = 0; i < comps; i++) {
          let id = i;
          datgui_state[name + strs[i]] = this.properties.default_uniforms[name][i];
          new_rt.add(datgui_state, name + strs[i]).step(0.05)
            .onChange(v => this.properties.default_uniforms[name][id] = v);
        }
      };
      this.uniforms.forEach(uni => {
        switch (uni.type) {
          case "float":
            add_vec(uni.name, 1);
            break;
          case "vec2":
            add_vec(uni.name, 2);
            break;
          case "vec3":
            add_vec(uni.name, 3);
            break;
        };
      });

      new_rt.open();
    }
  }

  gl_draw = (gl) => {
    let pipeline = this.getInputNodeByName("pipeline");
    if (pipeline == null)
      return;
    pipeline.bind(gl);
    var tu_cnt = 0;
    // builtins
    {
      let loc = pipeline.get_uniform_location(gl, "_resolution");

      if (loc) {
        let viewport = gl.getParameter(gl.VIEWPORT);
        gl.uniform2fv(loc, [viewport[2] - viewport[0], viewport[3] - viewport[1]]);
      }
    }
    for (let i in this.uniforms) {
      let uni = this.uniforms[i];
      let loc = pipeline.get_uniform_location(gl, uni.name);
      if (!loc)
        continue;
      let tu = tu_cnt;
      if (uni.type == "texture") {
        gl.activeTexture(gl.TEXTURE0 + tu);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.uniform1i(loc, tu);
        tu_cnt += 1;
      }
      let input = this.getInputNodeByName(uni.name);
      if (!input)
        continue;
      let input_link = this.getInputLinkByName(uni.name);
      if (uni.type == "texture") {
        let texture = input.get_texture(input_link.origin_slot);
        gl.activeTexture(gl.TEXTURE0 + tu);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.uniform1i(loc, tu);
      } else {
        let val = input.get_value(input_link.origin_slot);
        switch (uni.type) {
          case "int":
            gl.uniform1i(loc, val);
            break;
          default:
            throw Error("Unimplemented");
        };
      }
    }
    this.gl.arrays.forEach(arr => {
      gl.bindVertexArray(arr);

      gl.drawElements(gl.TRIANGLES, arr.draw_size, arr.index_type, 0);
    });


  }

  gl_release = (gl) => {
    this.gl.buffers.forEach(buf => gl.deleteBuffer(buf));
    this.gl.arrays.forEach(buf => gl.deleteVertexArray(buf));
    delete this.gl;
  }

  update = () => {
    this.update_inputs();
  }

  onSelected() {
  }

  onDeselected() {
  }

}

class FeedbackNode extends MyLGraphNode {
  constructor() {
    super();
    this.title = "Feedback";
    this.addInput("in", "uniform_t");
    this.addOutput("out", "uniform_t");
    this.gl = { tex: null };
    this.addWidget("button", "reset", null, (v) => { this.reset(); }, {});
  }
  reset = () => {
    let gl = global_state.gl;
    if (this.gl.tex)
      gl.deleteTexture(this.gl.tex);
    this.gl.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.gl.tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 1, 1);
  }
  is_recursive = () => true;
  get_texture = () => {
    if (!this.gl.tex) {
      this.reset();
    }
    return this.gl.tex;
  }
  gl_render = (gl) => {
    if (this.gl.tex)
      gl.deleteTexture(this.gl.tex);
    this.gl = { tex: null };
    let input_link = this.getInputLinkByName("in");
    if (!input_link)
      return;
    this.gl.tex = this.getInputNodeByName("in").clone_texture(input_link.origin_slot);
  }
}

class PassNode extends MyLGraphNode {
  constructor() {
    super();
    this.button = this.addWidget("button", "Add DC", null, (v) => { this.addDC(); }, {});
    this.title = "Pass";
    this.properties = {
      viewport: { width: 512, height: 512 },
      rts: [],
      depth: null,
      dc_cnt: 0,
    };
    this.yoffset = 100;
    this.onPropertyChange = (prop, val) => {
      this.update_outputs();
    };
    this.thumbnail_size = 256;
  }

  gl_render = (gl) => {
    this.bind(gl);
    this.inputs.forEach(input => {

      if (input.type == "drawcall_t") {
        let link = global_state.litegraph.links[input.link];
        if (!link)
          return;
        let dc = global_state.litegraph.getNodeById(link.origin_id);
        // console.log(dc);
        dc.gl_draw(gl);
      }
    });
    this.update_thumbnails(gl);
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
      this.addOutput("rt#" + i, "uniform_t");
    }
    if (this.properties.depth != null) {
      this.addOutput("depth", "uniform_t");
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

  is_valid = () => {
    return this.properties.rts.length != 0 || this.properties.depth;
  }

  gl_init = (gl) => {
    if (!this.is_valid())
      return;
    this.gl = { fb: null, rts: [] };
    this.gl.fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.gl.fb);
    assert(this.properties.rts.length != 0 || this.properties.depth != null);
    this.draw_buffers = [];
    this.gl.rts = [];
    for (let i = 0; i < this.properties.rts.length; ++i) {
      const tex = this.gen_texture(gl, i);
      this.gl.rts.push(tex);
      this.draw_buffers.push(gl.COLOR_ATTACHMENT0 + i);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, tex, 0);
    }

    if (this.properties.depth != null) {
      const tex = this.gen_texture(gl, this.properties.rts.length);
      this.gl.depth = tex;
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
    }
    var status = gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER);
    if (status != gl.FRAMEBUFFER_COMPLETE) {
      throw Error('fb status: ' + status.toString(16));
    }
  }

  clone_texture = (id) => {
    let gl = global_state.gl;
    // create to render to
    const targetTextureWidth = this.properties.viewport.width;
    const targetTextureHeight = this.properties.viewport.height;
    const targetTexture = this.gen_texture(gl, id);
    const srcTexture = this.get_texture(id);
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

    global_state.render_texture(srcTexture);

    gl.deleteFramebuffer(fb);
    return targetTexture;
  }

  gen_texture = (gl, id) => {
    if (id >= this.properties.rts.length) {
      let rt = this.properties.depth;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      var format = null;

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
      // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texStorage2D(gl.TEXTURE_2D, 1, format,
        this.properties.viewport.width, this.properties.viewport.height);
      return tex;
    } else {
      let rt = this.properties.rts[id];
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      var format = null;
      switch (rt.format) {
        case "RGBA8": {
          format = gl.RGBA8;
        }
          break;
        case "RGBA32F": {
          format = gl.RGBA32F;
        }
          break;
        default:
          throw Error("unknown format");
      }
      // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texStorage2D(gl.TEXTURE_2D, 1, format,
        this.properties.viewport.width, this.properties.viewport.height);
      return tex;
    }
  }

  get_texture = (id) => {
    if (id >= this.properties.rts.length)
      return this.gl.depth;
    return this.gl.rts[id];
  }

  bind = (gl) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.gl.fb);
    gl.drawBuffers(this.draw_buffers);
    gl.viewport(0, 0, this.properties.viewport.width, this.properties.viewport.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  update_thumbnails = (gl) => {
    this.thumbnails = [];
    let rts = [...this.gl.rts];
    if (this.gl.depth)
      rts.push(this.gl.depth);
    for (let i in rts) {
      let image_data = global_state.get_texture_data(rts[i],
        // this.properties.rts[i].format,
        "RGBA32F",
        this.thumbnail_size, this.thumbnail_size);

      let tmp_canvas = document.createElement("canvas");
      let tmp_canvasContext = tmp_canvas.getContext("2d");
      tmp_canvas.width = image_data.width;
      tmp_canvas.height = image_data.height;
      tmp_canvasContext.putImageData(image_data, 0, 0);
      var img = document.createElement("img");
      img.src = tmp_canvas.toDataURL("image/png");
      img.onload = () => { global_state.update_thumbnails() };
      this.thumbnails.push(img);
    }
    if (this.gl.depth)
      this.depth_thumbnail = this.thumbnails[this.thumbnails.length - 1];
    global_state.update_thumbnails();
  }

  gl_release = (gl) => {
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
      format: "RGBA8",
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
    new_rt.add(tmp_rt_state, 'format', ["RGBA8", "RGBA32F"]);
    new_rt.add(datgui_state, 'push');
    new_rt.add(datgui_state, 'pop');
    new_rt.open();
    let new_d = propnode.datgui.addFolder("Add depth target");
    new_d.add(tmp_d_state, 'format', ["D16", "D32"]);
    new_d.add(datgui_state, 'add_depth');
    new_d.add(datgui_state, 'remove_depth');
    new_d.open();
    let vp = propnode.datgui.addFolder("Viewport");
    vp.add(datgui_state, 'width', 128, 1024 * 2, 16).onChange((v) => this.set_width(v));;
    vp.add(datgui_state, 'height', 128, 1024 * 2, 16).onChange((v) => this.set_height(v));;
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
    var yoffset = 32 + this.inputs.length * 20;
    var xoffset = 16;
    var border = 16;
    var size = this.size[0] - border * 2;
    this.thumbnail_size = size;
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
    this.onResize = this.onResize.bind(this);
    this.dumpJson = this.dumpJson.bind(this);
  }

  componentDidMount() {
    global_state.load_graph(graph_list[0]);
    this.props.glContainer.on('resize', this.onResize);
    this.onResize();

  }

  onResize = () => {
    let parent = document.getElementById("tmp_canvas_container");
    global_state.on_resize(parent.offsetWidth, parent.offsetHeight - 70);
  }

  dumpJson() {

    // console.log();
    // https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript?page=1&tab=votes#tab-top
    function copyTextToClipboard(text) {
      var textArea = document.createElement("textarea");
      textArea.style.position = 'fixed';
      textArea.style.top = 0;
      textArea.style.left = 0;
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = 0;
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        var successful = document.execCommand('copy');
        var msg = successful ? 'successful' : 'unsuccessful';
        console.log('Copying text command was ' + msg);
      } catch (err) {
        console.log('Oops, unable to copy');
      }

      document.body.removeChild(textArea);
    }
    let json = global_state.litegraph.serialize();
    let str = JSON.stringify(json)
    // let msg = {};
    // msg.data = str;
    // msg.type = "graph.json";
    // if (window.parent != window)
    //   window.parent.postMessage(JSON.stringify(msg), '*');
    copyTextToClipboard(str);

  }

  render() {

    return (
      <div style={{ width: '100%', height: '100%' }} id="tmp_canvas_container">
        <Button style={{ margin: 10 }} onClick={this.dumpJson}>
          Copy to clipboard
                </Button>
        <Button style={{ margin: 10 }} onClick={() => { console.log(global_state.litegraph_canvas.selected_nodes); }}>
          Dump Selected
                </Button>
        <Button variant="danger" style={{ margin: 10 }} onClick={() => { global_state.exec_reset(); }}>
          Clear
                </Button>

        <Button style={{ margin: 10 }} onClick={() => {
          // console.log(global_state.toposort());
          global_state.draw();
        }} variant="success" >
          Next Frame
                </Button>
        <LoadGraphButton />
        <canvas id='tmp_canvas' style={{ border: '1px solid' }}></canvas>
      </div>
    );
  }
}

{/* <Button style={{ margin: 10 }} onClick={() => { global_state.update(); }}>
force update
      </Button>
<Button style={{ margin: 10 }} onClick={() => { global_state.reload(); }}>
force reload
      </Button> */}

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
    if (!("litegraph" in global_state))
      return;
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
    // ace.require("ace/ext/language_tools");

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
    this.refs.editor.editor.setOptions({
      // fontFamily: "Consolas",
      // enableSnippets: true,
      // enableBasicAutocompletion: true,
      // enableLiveAutocompletion: true,
      fontSize: "8pt"
    });
    this.refs.editor.editor.setAutoScrollEditorIntoView(true);
    this.refs.editor.editor.getSession().setOptions({
      tabSize: 2,
      useSoftTabs: true,
      navigateWithinSoftTabs: true

    });
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
          enableBasicAutocompletion={true}
          enableLiveAutocompletion={true}
          autoScrollEditorIntoView={false}
          wrapEnabled={false}
          height="calc(100% - 100px)"
          width="calc(100%)"
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
      selected_node.subscribe(this);
    },
      (deselected_node) => {
        if (this.selected_node == deselected_node) {
          this.selected_node = null;
          this.clear_gui();
          deselected_node.unsubscribe(this);
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
    this.subscribers = new Set();
  }

  subscribe = (node) => { this.subscribers.add(node) }
  unsubscribe = (node) => { this.subscribers.delete(node) }
  notify = () => { this.subscribers.forEach(node => { if (node.set_dirty) node.set_dirty() }) }
  set_dirty = () => { global_state.set_dirty(this); }

  update = () => {
    this.clear_gui();
    this.display_node(this.selected_node);
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
    this.datgui = new dat.GUI({ autoPlace: false, width: "100%" });
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
            type: 'column',
            content: [
              {
                type: 'react-component',
                isClosable: false,
                component: 'TextEditor',
                title: 'Text Editor',

                props: { globals: () => this.globals }


              },
              {
                type: 'stack',
                width: 84,
                height: 40,
                content: [
                  {
                    type: 'react-component',
                    isClosable: false,
                    component: 'PropertiesNode',
                    title: 'Properties',
                    props: { globals: () => this.globals }

                  },
                  {

                    type: 'react-component',
                    isClosable: false,
                    component: 'GLW',
                    title: 'Back Buffer',
                    props: { globals: () => this.globals }

                  },
                ]
              }
            ]
          },
          {
            type: 'react-component',
            isClosable: false,
            component: 'Graphs',
            title: 'Graphs',
            props: { globals: () => this.globals },
            width: 145

          },


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