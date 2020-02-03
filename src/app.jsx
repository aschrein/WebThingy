import GoldenLayout from 'golden-layout';
import React from 'react';
import ReactDOM from 'react-dom';
import Markdown from 'react-markdown';
import './css/main.css';
import 'litegraph.js/css/litegraph.css'
import AceEditor from 'react-ace';
import 'brace/mode/assembly_x86';
// Import a Theme (okadia, github, xcode etc)
import 'brace/theme/tomorrow_night_eighties';
import { JSONEditor } from 'react-json-editor-viewer';
import { LGraph, LGraphCanvas, LiteGraph, LGraphNode } from 'litegraph.js';
import GLComponent from './glnodes';
import * as dat from 'dat.gui';

class BackBufferNode extends LGraphNode {
  constructor() {
    super();
    this.addInput("in", "texture_t");
    this.properties = {};
    this.title = "Back Buffer Node";
  }
}

class DrawCallNode extends LGraphNode {
  constructor() {
    super();
    this.addOutput("out", "drawcall_t");
    this.properties = {};
    this.title = "Draw Call Node";
    this.text = this.addWidget("text", "Attrubute Name", "edit me", function (v) { }, {});
    this.addAttribute = this.addAttribute.bind(this);
    this.button = this.addWidget("button", "Add Attrubute", null, (v) => { this.addAttribute(this.text.value) }, {});
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
    this.graph = new LGraph();
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
    this.dumpJson();
  }

  onResize() {
    this.canvas.resize();
  }

  dumpJson() {
    var json = this.graph.serialize();
    console.log(JSON.stringify(json));
    // var data = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(json));

    json = require('./default_graph.json');

    var graph = this.graph;
    graph.clear();
    setTimeout(function () {
      graph.configure(json, false);
    }, 1000);

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

class TextEditorComponent extends React.Component {

  constructor(props, context) {
    super(props, context);

    this.onChange = this.onChange.bind(this);
    this.Execute = this.Execute.bind(this);
    this.PauseResume = this.PauseResume.bind(this);
    this.onResize = this.onResize.bind(this);
    this.setText = this.setText.bind(this);
    this.setClocks = this.setClocks.bind(this);
    this.state = { clocks: 0 };

  }

  componentDidMount() {
    // this.refs.editor.setValue(
    //     "ret"
    // );
    this.props.glContainer.on('resize', this.onResize);
    // this.props.globals().setText = this.setText;
    // this.props.globals().setClocks = this.setClocks;
  }

  onChange(newValue) {
    this.text = newValue;
  }

  onResize() {
    this.refs.editor.editor.resize();
  }

  PauseResume() {
    if (this.props.globals().wasm) {
      this.props.globals().run = !this.props.globals().run;
    }
  }
  setClocks(clocks) {
    this.setState({ clocks: clocks });
  }
  setText(text) {
    this.refs.editor.editor.setValue(text);
  }

  Execute() {
    let globals = this.props.globals();

  }
  render() {

    return (
      <div className="ace_editor_container">

        <AceEditor
          value={this.text}
          ref="editor"
          mode="assembly_x86"
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
    var TokenString = require('glsl-tokenizer/string');
    var ParseTokens = require('glsl-parser/direct');
    // var reader = new FileReader();

    // reader.onload = function (theFile) {

    // };

    // reader.readAsDataURL('test.glsl');


    fetch('shaders/test.glsl')
      .then(response => response.text())
      .then(text => {
        console.log(text);
        var tokens = TokenString(text);
        var ast = ParseTokens(tokens);
        console.log(ast);
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