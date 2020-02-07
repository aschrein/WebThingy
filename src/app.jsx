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
import { LGraph, LGraphCanvas, LiteGraph, LGraphNode } from 'litegraph.js';
// import GLComponent from './glnodes';
import * as dat from 'dat.gui';
// import {Button, useState} from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { vec2, vec3, vec4, mat2, mat3, mat4, quat } from 'gl-matrix';
import { Modal, Button, FormControl } from 'react-bootstrap';

var TokenString = require('glsl-tokenizer/string');
var ParseTokens = require('glsl-parser/direct');

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

class GLComponent extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.graph = new LGraph();
    this.canvas = null;
    this.onResize = this.onResize.bind(this);
  }

  componentDidMount() {
    var canvas = document.getElementById("myglcanvas");
    var gl = canvas.getContext('webgl2', { alpha: false });
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
    gl.clearColor(0, 0, 1, 1);
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
      0.0, 0.0, 1.0
    ]);

    var colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(1);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

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

class BackBufferNode extends LGraphNode {
  constructor() {
    super();
    this.addInput("in", "texture_t");
    this.properties = {};
    this.title = "Back Buffer Node";
  }
}

class PipelineNode extends LGraphNode {
  constructor() {
    super();

    this.properties = {
      vs: null,
      ps: null,
    };
    this.addOutput("out", "pipeline_t");
    this.title = "Pipeline State Node";
    this.attributes = [];
    global_state.exec_after('remove_src', (cmd) => {
      if (cmd.src_name == this.vs) {
        this.set_vs(null);
      }
      if (cmd.src_name == this.ps) {
        this.set_ps(null);
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

  parse_shaders() {
    this.clean_inputs();
    this.attributes = [];
    if (this.vs != null) {
      try {
        // Parse vertex shader for attributes
        var tokens = TokenString(this.vs);
        var ast = ParseTokens(tokens);
        // console.log(ast);
        for (let i = 0; i < ast.children.length; i++) {
          let chld = ast.children[i];
          // console.log(chld);
          if (chld.token.data == "attribute") {
            var type = null;
            for (let j = 0; j < chld.children[0].children.length; j++) {
              let chld_1 = chld.children[0].children[j];

              if (chld_1.type == "decllist") {
                let name = chld_1.children[0].data;
                // console.log(type + " " + chld_1.children[0].data);
                this.attributes.push({ name: name, type: type });
              }

              if (chld_1.token.type == "keyword") {
                type = chld_1.token.data + "_t";
              }
            }

          }
        }
      } catch (e) {
        console.log(e);
      }
    }
    // for (let i in this.attributes) {
    //   this.addInput(this.attributes[i].name, "attribute_t");
    // }
  }

  onSelected() {
  }

  onDeselected() {
  }

}

class DrawCallNode extends LGraphNode {
  constructor() {
    super();
    this.addOutput("out", "drawcall_t");

    this.title = "Draw Call Node";
  }


  onSelected() {
  }

  onDeselected() {
  }

  addAttribute(name) {
    this.addInput(name, "attribute_t");
  }
}

class PassNode extends LGraphNode {
  constructor() {
    super();
    // this.addInput("in#0", "texture_t");
    // this.addInput("in#0", "vec4_t");
    // this.addOutput("out#0", "texture_t");
    // this.addDC = this.addDC.bind(this);
    // this.slider = this.addWidget("slider", "Slider", 0.5, function (v) { }, { min: 0, max: 1 });
    // this.button = this.addWidget("button", "Button", null, (v) => { this.addDC(); }, {});
    // this.properties = { dc_cnt: 0 };
    this.title = "Pass Node";
    this.properties = {
      viewport: { width: 512, height: 512 },
      rts: [],
    };
  }

  push_rt = (params) => {
    let rt_params = {};
    rt_params.format = params.format;
    this.properties.rts.push(rt_params)
  }

  pop_rt = () => {
    // for (let i = this.properties.rts.length - 1; i >= 0; i--) {
    //   delete this.properties.rts[i];
    //   break;
    // }
    this.properties.rts.pop();
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

  onDrawBackground(ctx) {
    if (this.flags.collapsed) {
      return;
    }

    var size = this.size;

    var scale = (0.5 * size[1]) / this.properties.scale;

    var offset = size[1] * 0.5;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, size[0], size[1]);
    ctx.strokeStyle = "#555";


  }

  clearInput() {
    // let len = this.inputs.length;
    // for (let i = len - 1; i >= 0; i--) {
    //   this.removeInput(i);
    // }
    // this.properties.dc_cnt = 0;
  }

  // addDC() {
  //   this.addInput("DC#" + this.properties.dc_cnt, "drawcall_t");
  //   this.properties.dc_cnt += 1;
  // }

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

    global_state.litegraph_canvas = new LGraphCanvas("#mycanvas", this.graph);
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
    var node_const = LiteGraph.createNode("basic/const");
    node_const.pos = [200, 200];
    this.graph.add(node_const);
    node_const.setValue(4.5);

    var node_watch = LiteGraph.createNode("basic/watch");
    node_watch.pos = [700, 200];
    this.graph.add(node_watch);

    node_const.connect(0, node_watch, 0);

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
      <div style={{ width: '100%', height: '100%' }} id="mycanvas_container">
        <Button style={{ margin: 10 }} onClick={this.dumpJson}>
          log json
                </Button>
        <Button style={{ margin: 10 }} onClick={() => { console.log(global_state.litegraph_canvas.selected_nodes); }}>
          log selection
                </Button>
        <Button style={{ margin: 10 }} onClick={() => { global_state.exec_reset(); }}>
          clear graph
                </Button>
        <canvas id='mycanvas' width='50%' height='50%' style={{ border: '1px solid' }}></canvas>
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
    // console.log(this.current_src + " has changed to " + newValue);
    global_state.litegraph.config.srcs[this.selected_src].code = newValue;
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
    if (this.selected_node != null) {
      if (this.selected_node.type == "gfx/PipelineNode") {
        this.display_pipeline(node);
      } else if (this.selected_node.type == "gfx/PassNode") {
        this.display_pass(node);
      }
    }
  }

  display_pipeline = (pipeline) => {
    this.datgui = new dat.GUI({ autoPlace: false });

    let src_list = [];
    console.log(pipeline);
    let datgui_state = {
      select_vs: pipeline.properties.vs,
      select_ps: pipeline.properties.ps,
    };
    Object.keys(global_state.litegraph.config.srcs).forEach(e => src_list.push(e));
    this.datgui.add(datgui_state, 'select_vs', src_list)
      .onChange((v) => pipeline.set_vs(v));
    this.datgui.add(datgui_state, 'select_ps', src_list)
      .onChange((v) => pipeline.set_ps(v));

    var customContainer = document.getElementById('PropertiesNodeWrapper');
    customContainer.appendChild(this.datgui.domElement);
  }

  display_pass = (pass) => {
    this.datgui = new dat.GUI({ autoPlace: false });

    let tmp_rt_state = {
      format: "RGBA_U8",
    };
    let datgui_state = {
      width: pass.properties.viewport.width,
      height: pass.properties.viewport.height,
      push: () => {
        pass.push_rt(tmp_rt_state);
        this.clear_gui();
        this.display_node(pass);
      },
      pop: () => {
        pass.pop_rt();
        this.clear_gui();
        this.display_node(pass);
      },
    };
    let rts = this.datgui.addFolder("Render targets");
    for (let i in pass.properties.rts) {
      let rt = pass.properties.rts[i];
      let rt_state = {
        format: rt.format,
      };
      rts.add(rt_state, 'format');
    }
    rts.open();
    let new_rt = this.datgui.addFolder("Create render target");
    new_rt.add(tmp_rt_state, 'format', ["RGBA_U8", "RGBA_F32"]);
    new_rt.add(datgui_state, 'push');
    new_rt.add(datgui_state, 'pop');
    new_rt.open();
    let vp = this.datgui.addFolder("Viewport");
    vp.add(datgui_state, 'width', 1, 1024).onChange((v) => pass.set_width(v));;
    vp.add(datgui_state, 'height', 1, 1024).onChange((v) => pass.set_height(v));;
    vp.open();

    // this.datgui.add(this.datgui_state, 'select_vs', this.src_list)
    //   .onChange((v) => pipeline.set_vs(v));
    // this.datgui.add(this.datgui_state, 'select_ps', this.src_list)
    //   .onChange((v) => pipeline.set_ps(v));

    var customContainer = document.getElementById('PropertiesNodeWrapper');
    customContainer.appendChild(this.datgui.domElement);
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