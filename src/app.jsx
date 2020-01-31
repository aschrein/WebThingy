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
import { LGraph, LGraphCanvas, LiteGraph } from 'litegraph.js';
import GLComponent from './glnodes';

class GraphNodeComponent extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.graph = new LGraph();
    this.canvas = null;
    this.onResize = this.onResize.bind(this);
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

  }

  onResize() {
    this.canvas.resize();
  }


  render() {

    return (
      <canvas id='mycanvas' width='50%' height='50%' style={{ border: '1px solid' }}></canvas>

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
            component: 'TextEditor',
            title: 'TextEditor',
            props: { globals: () => this.globals }

          },
          {
            type: 'react-component',
            component: 'Graphs',
            title: 'Graphs',
            props: { globals: () => this.globals }

          },
          {
            type: 'react-component',
            component: 'GLW',
            title: 'GLW',
            props: { globals: () => this.globals }

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