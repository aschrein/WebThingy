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
import GLComponent from './glnodes';
import * as dat from 'dat.gui';
// import {Button, useState} from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
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
// // Injected by text editor. edit_text(text) sends text to the editor
// global_state.edit_text = null;
// // Reference to the selected draw call
// global_state.selected_pipeline = null;
// global_state.set_text = (v) => {
//   if (global_state.selected_pipeline) global_state.selected_pipeline.set_text(v);
// };
// Reference to the litegraph instance
global_state.litegraph = new LGraph();
// A list of subscribers to notify when graph is loaded
// global_state.on_graph_loaded = [];
function init_litegraph(json) {
  global_state.litegraph.clear();
  // setTimeout(function () {
  global_state.litegraph.configure(json, false);
  // }, 1000);
}
init_litegraph(require('./default_graph.json'));

// TODO:
// * shader node/pipeline node
// * drawcall node
//   * input attribute stream
//   * input uniform hvalues(matrices, vector, float, ints, textures+texture sizes)
// * camera node(generates look,up,left vectors and view/projection/inverse matrices)
// * shader code editing
//   * live update
// * pass node
//   * multiple drawcalls as inputs
//   * multiple output render targets
//   * live view render targets(configure custom visualization shader)

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
    this.set_text = this.set_text.bind(this);
    this.parse_shader = this.parse_shader.bind(this);
    this.shader_valid = false;
    this.addOutput("out", "drawcall_t");
    this.properties = { code: "" };
    this.title = "Draw Call Node";
    this.text = this.addWidget("text", "Attrubute Name", "edit me", function (v) { }, {});
    this.addAttribute = this.addAttribute.bind(this);
    this.button = this.addWidget("button", "Add Attrubute", null, (v) => { this.addAttribute(this.text.value) }, {});
    this.attributes = [];
  }

  parse_shader() {
    let len = this.inputs.length;
    for (let i = len - 1; i >= 0; i--) {
      this.removeInput(i);
    }
    this.shader_valid = false;
    this.attributes = [];
    try {
      var tokens = TokenString(this.properties.code);
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
      this.shader_valid = true;
    } catch (e) {
      console.log(e);
    }
    if (this.shader_valid) {
      for (let i in this.attributes) {
        this.addAttribute(this.attributes[i].name);
      }
    }
  }

  set_text(v) {
    this.properties.code = v;
    this.parse_shader();
  }

  onSelected() {
    global_state.selected_pipeline = this;
    global_state.edit_text(this.properties.code);
  }

  onDeselected() {
    global_state.selected_pipeline = null;
  }

  addAttribute(name) {
    this.addInput(name, "attribute_t");
  }
}

class DrawCallNode extends LGraphNode {
  constructor() {
    super();
    this.set_text = this.set_text.bind(this);
    this.parse_shader = this.parse_shader.bind(this);
    this.shader_valid = false;
    this.addOutput("out", "drawcall_t");
    this.properties = { code: "" };
    this.title = "Draw Call Node";
    this.text = this.addWidget("text", "Attrubute Name", "edit me", function (v) { }, {});
    this.addAttribute = this.addAttribute.bind(this);
    this.button = this.addWidget("button", "Add Attrubute", null, (v) => { this.addAttribute(this.text.value) }, {});
    this.attributes = [];
  }

  parse_shader() {
    let len = this.inputs.length;
    for (let i = len - 1; i >= 0; i--) {
      this.removeInput(i);
    }
    this.shader_valid = false;
    this.attributes = [];
    try {
      var tokens = TokenString(this.properties.code);
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
      this.shader_valid = true;
    } catch (e) {
      console.log(e);
    }
    if (this.shader_valid) {
      for (let i in this.attributes) {
        this.addAttribute(this.attributes[i].name);
      }
    }
  }

  set_text(v) {
    this.properties.code = v;
    this.parse_shader();
  }

  onSelected() {
    global_state.selected_pipeline = this;
    global_state.edit_text(this.properties.code);
  }

  onDeselected() {
    global_state.selected_pipeline = null;
  }

  addAttribute(name) {
    this.addInput(name, "attribute_t");
  }
}

class PassNode extends LGraphNode {
  constructor() {
    super();
    this.addInput("in#0", "texture_t");
    this.addInput("in#0", "vec4_t");
    this.addOutput("out#0", "texture_t");
    this.addDC = this.addDC.bind(this);
    this.slider = this.addWidget("slider", "Slider", 0.5, function (v) { }, { min: 0, max: 1 });
    this.button = this.addWidget("button", "Button", null, (v) => { this.addDC(); }, {});
    this.properties = { dc_cnt: 0 };
    this.title = "Pass Node";
  }

  onExecute() {
    var A = this.getInputData(0);
    if (A === undefined)
      A = 0;
    var B = this.getInputData(1);
    if (B === undefined)
      B = 0;
    this.setOutputData(0, "texture_0");
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
    let len = this.inputs.length;
    for (let i = len - 1; i >= 0; i--) {
      this.removeInput(i);
    }
    this.properties.dc_cnt = 0;
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
    this.canvas = null;
    this.onResize = this.onResize.bind(this);
    this.dumpJson = this.dumpJson.bind(this);
  }

  componentDidMount() {

    this.canvas = new LGraphCanvas("#mycanvas", this.graph);
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
    this.canvas.resize();

    //node constructor class
    function MyAddNode() {
      this.addInput("A", "number");
      this.addInput("B", "number");
      this.addOutput("A+B", "number");
      this.properties = { precision: 1 };
    }

    //name to show
    MyAddNode.title = "Sum";

    //function to call when the node is executed
    MyAddNode.prototype.onExecute = function () {
      var A = this.getInputData(0);
      if (A === undefined)
        A = 0;
      var B = this.getInputData(1);
      if (B === undefined)
        B = 0;
      this.setOutputData(0, A + B);
    }

    MyAddNode.prototype.onDrawBackground = function (ctx) {
      if (this.flags.collapsed) {
        return;
      }

      var size = this.size;

      var scale = (0.5 * size[1]) / this.properties.scale;

      var offset = size[1] * 0.5;

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, size[0], size[1]);
      ctx.strokeStyle = "#555";


    };

    //register in the system
    LiteGraph.registerNodeType("gfx/sum", MyAddNode);
    LiteGraph.registerNodeType("gfx/test", PassNode);
    LiteGraph.registerNodeType("gfx/BackBufferNode", BackBufferNode);
    LiteGraph.registerNodeType("gfx/DrawCallNode", DrawCallNode);
    // this.graph.config.shaders = { "simple_vs": "#version 300 es\nprecision mediump float;\nattribute vec2 position;\nattribute vec3 normal;\nvarying vec2 uv;\nvoid main() {\n  uv = 0.5 * (position + 1.0);\n  gl_Position = vec4(position, 0, 1);\n}" };
    this.dumpJson();
  }

  onResize() {
    this.canvas.resize();
  }

  dumpJson() {
    var json = this.graph.serialize();
    console.log(JSON.stringify(json));


  }

  render() {

    return (
      <div style={{ width: '100%', height: '100%' }} id="mycanvas_container">
        <button style={{ margin: 10 }} onClick={this.dumpJson}>
          Get json
                </button>
        <canvas id='mycanvas' width='50%' height='50%' style={{ border: '1px solid' }}></canvas>
      </div>
    );
  }
}

// A button that spawns a modal window with text input and submit button
// @TODO: validation
class CreateShader extends React.Component {
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
          New shader
      </Button>

        <Modal show={this.state.visible} onHide={this.handleClose}>
          <Modal.Header closeButton>
            <Modal.Title>Enter name</Modal.Title>
          </Modal.Header>
          <FormControl type="text" placeholder="shader name" onChange={e => this.myInput.value = e.target.value} />
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
    // this.Execute = this.Execute.bind(this);
    this.onResize = this.onResize.bind(this);
    // this.setText = this.setText.bind(this);
    // this.state = { clocks: 0 };
    // global_state.edit_text = (t) => { this.setText(t); };
    this.selected_shader = null;
  }

  rebuildGui = () => {
    this.datgui = new dat.GUI({ autoPlace: false });
    this.shader_list = [];
    this.datgui_state = {
      select_shader: this.selected_shader,
      remove_shader: () => { this.removeShader(); },
    };
    Object.keys(global_state.litegraph.config.shaders).forEach(e => this.shader_list.push(e));
    this.datgui.shader_list = this.datgui.add(this.datgui_state, 'select_shader', this.shader_list)
      .onChange((v) => this.editShader(v));
    this.datgui.add(this.datgui_state, 'remove_shader');

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
    this.editShader(null);
    this.rebuildGui();
  }

  editShader = (name) => {
    if (name == null) {
      this.selected_shader = null;
      this.refs.editor.editor.setValue("");
      return;
    }
    assert(name in global_state.litegraph.config.shaders);
    this.selected_shader = name;
    this.refs.editor.editor.setValue(global_state.litegraph.config.shaders[name].code);
  }

  addShader = (name) => {
    assert(!(name in global_state.litegraph.config.shaders));
    global_state.litegraph.config.shaders[name] = { code: "" };
    // this.datgui.shader_list = this.datgui.shader_list.options(this.shader_list)
    //   .onChange((v) => this.editShader(v));
    this.editShader(name);
    this.rebuildGui();
    
  }

  removeShader = () => {
    if (this.selected_shader == null)
      return;
    assert(this.selected_shader in global_state.litegraph.config.shaders);
    delete global_state.litegraph.config.shaders[this.selected_shader];
    this.editShader(null);
    this.rebuildGui();
  }

  onChange(newValue) {
    if (this.selected_shader == null)
      return;
    // console.log(this.current_shader + " has changed to " + newValue);
    global_state.litegraph.config.shaders[this.selected_shader].code = newValue;
  }

  onResize() {
    this.refs.editor.editor.resize();
  }

  // setClocks(clocks) {
  //   this.setState({ clocks: clocks });
  // }

  // setText(text) {
  //   this.refs.editor.editor.setValue(text);
  // }

  // Execute() {

  // }

  render() {

    return (
      <div className="ace_editor_container">
        <CreateShader on_submit={(name) => this.addShader(name)} />
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

class InputNode extends React.Component {

  constructor(props, context) {
    super(props, context);

  }

  componentDidMount() {

    var text = {
      message: 'dat.gui',
      speed: 0.8,
      displayOutline: false,
    };

    var gui = new dat.GUI({ autoPlace: false });
    var menu = gui.addFolder('folder');
    menu.add(text, 'message');
    menu.add(text, 'speed', -5, 5);
    menu.add(text, 'displayOutline');

    var customContainer = document.getElementById('InputDodeWrapper');
    customContainer.appendChild(gui.domElement);


  }

  render() {

    return (
      <div id='InputDodeWrapper'>
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
              component: 'InputNode',
              title: 'InputNode',
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
    layout.registerComponent('InputNode',
      InputNode
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