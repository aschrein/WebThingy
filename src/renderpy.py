from OpenGL.GL import *
import OpenGL.GL as gl
from OpenGL.GLUT import *
from OpenGL.GLU import *
import numpy as np
import matplotlib.cm as cm
import matplotlib.pyplot as plt
import matplotlib.cbook as cbook
from matplotlib.path import Path
from matplotlib.patches import PathPatch
import json
from OpenGL.GL import shaders

# print(json.load(open("../public/default_graph.json")))public/models/LeePerrySmith/LeePerrySmith.gltf

WIDTH, HEIGHT = 512, 512

# import trimesh
# # trimesh.util.attach_to_log()
# mesh = trimesh.load('public/models/LeePerrySmith/LeePerrySmith.gltf')
# mesh.show()


class Node:
  def __init__(self, global_state, json_node):
    self.id = json_node["id"]
    self.title = json_node["title"]
    self.outputs = []
    self.inputs = []
    for o in json_node["outputs"]:
      self.outputs.append(o)
    for o in json_node["inputs"]:
      self.inputs.append(o)
    self.properties = json_node["properties"]


class PipelineNode(Node):
  def __init__(self, global_state, json_node):
    super().__init__(global_state, json_node)
    assert("vs" in self.properties and "ps" in self.properties)

  def bind(self, global_state, gl):
    pass

  def release(self, global_state, gl):
    pass


class BackBufferNode(Node):
  def __init__(self, global_state, json_node):
    super().__init__(global_state, json_node)


class FrameCountNode(Node):
  def __init__(self, global_state, json_node):
    super().__init__(global_state, json_node)


class Mesh:
  def __init__(self):
    pass


class ModelNode(Node):
  def __init__(self, global_state, json_node):
    super().__init__(global_state, json_node)
    assert("fileurl" in self.properties)


class VertexBufferNode(Node):
  def __init__(self, global_state, json_node):
    super().__init__(global_state, json_node)
    assert("src" in self.properties)


class TextureBufferNode(Node):
  def __init__(self, global_state, json_node):
    super().__init__(global_state, json_node)
    assert("src" in self.properties)


class DrawCallNode(Node):
  def __init__(self, global_state, json_node):
    super().__init__(global_state, json_node)
    # assert("default_uniforms" in self.properties)


class FeedbackNode(Node):
  def __init__(self, global_state, json_node):
    super().__init__(global_state, json_node)


class PassNode(Node):
  def __init__(self, global_state, json_node):
    super().__init__(global_state, json_node)
    assert("viewport" in self.properties and "rts" in self.properties)


class GlobalState:
  def __init__(self):
    self.nodes = []
    self.id2node = {}
    self.links = []
    self.id2link = {}
    pass

  def toposort(self):
    """
    Returns the list of nodes in inverse topological order
    """
    pass

  def load_json(self, filename):
    self.json = json.load(open(filename))
    self.release()
    self.nodes = []
    self.id2node = {}
    self.links = []
    self.id2link = {}
    assert("nodes" in self.json)
    for json_node in self.json["nodes"]:
      if json_node["type"] == "gfx/PassNode":
        self.nodes.append(PassNode(self, json_node))
      elif json_node["type"] == "gfx/BackBufferNode":
        self.nodes.append(BackBufferNode(self, json_node))
      elif json_node["type"] == "gfx/DrawCallNode":
        self.nodes.append(DrawCallNode(self, json_node))
      elif json_node["type"] == "gfx/PipelineNode":
        self.nodes.append(PipelineNode(self, json_node))
      elif json_node["type"] == "gfx/VertexBufferNode":
        self.nodes.append(VertexBufferNode(self, json_node))
      elif json_node["type"] == "gfx/ModelNode":
        self.nodes.append(ModelNode(self, json_node))
      elif json_node["type"] == "gfx/TextureBufferNode":
        self.nodes.append(TextureBufferNode(self, json_node))
      elif json_node["type"] == "gfx/FeedbackNode":
        self.nodes.append(FeedbackNode(self, json_node))
      elif json_node["type"] == "gfx/FrameCountNode":
        self.nodes.append(FrameCountNode(self, json_node))
      else:
        assert(False and "unknown node type")

    pass

  def render_triangle(self):
    vsSource = """#version 300 es

      layout (location=0) in vec4 position;
      layout (location=1) in vec3 color;

      out vec3 vColor;

      void main() {

          vColor = color;
          gl_Position = position;
      }
      """
    fsSource = """#version 300 es
      precision highp float;
      in vec3 vColor;
      out vec4 fragColor;

      void main() {
          fragColor = vec4(vColor, 1.0);
      }
      """

    VERTEX_SHADER = shaders.compileShader(vsSource, gl.GL_VERTEX_SHADER)

    FRAGMENT_SHADER = shaders.compileShader(fsSource, gl.GL_FRAGMENT_SHADER)

    program = shaders.compileProgram(VERTEX_SHADER, FRAGMENT_SHADER)

    gl.glUseProgram(program)

    triangleArray = gl.glGenVertexArrays(1)
    gl.glBindVertexArray(triangleArray)

    positions = np.float32([
        -0.5, -0.5, 0.0,
        0.5, -0.5, 0.0,
        0.0, 0.5, 0.0
    ])

    positionBuffer = gl.glGenBuffers(1)
    gl.glBindBuffer(gl.GL_ARRAY_BUFFER, positionBuffer)
    gl.glBufferData(gl.GL_ARRAY_BUFFER, positions, gl.GL_STATIC_DRAW)
    gl.glVertexAttribPointer(0, 3, gl.GL_FLOAT, False, 0, None)
    gl.glEnableVertexAttribArray(0)

    colors = np.float32([
        1.0, 0.0, 0.0,
        0.0, 1.0, 0.0,
        1.0, 0.0, 1.0
    ])

    colorBuffer = gl.glGenBuffers(1)
    gl.glBindBuffer(gl.GL_ARRAY_BUFFER, colorBuffer)
    gl.glBufferData(gl.GL_ARRAY_BUFFER, colors, gl.GL_STATIC_DRAW)
    gl.glVertexAttribPointer(1, 3, gl.GL_FLOAT, False, 0, None)
    gl.glEnableVertexAttribArray(1)

    gl.glDisable(gl.GL_CULL_FACE)
    gl.glFrontFace(gl.GL_CW)
    gl.glDisable(gl.GL_DEPTH_TEST)
    gl.glDisable(gl.GL_SCISSOR_TEST)
    gl.glDepthFunc(gl.GL_LEQUAL)
    gl.glDisable(gl.GL_BLEND)
    gl.glBlendFunc(gl.GL_ONE, gl.GL_ONE)
    gl.glDrawArrays(gl.GL_TRIANGLES, 0, 3)

    gl.glDeleteBuffers(1, positionBuffer)
    gl.glDeleteBuffers(1, colorBuffer)
    gl.glDeleteVertexArrays(1, triangleArray)
    gl.glDeleteProgram(program)

  def render_texture(self, tex, format=None, flipy=False):
    """
    Renders a fullscreen quad with the given texture
    """
    vsSource = """#version 300 es
      precision highp float;
        in vec2 position;
        out vec2 uv;
        void main() {
            uv = 0.5 * (position + 1.0);
            uv.y = 1.0 - uv.y;
            gl_Position = vec4(position, 0, 1);
        }
      """
    fsSource = """#version 300 es
      precision highp float;
      precision highp int;
      precision highp usampler2D;
      precision highp isampler2D;
      in vec2 uv;
      uniform sampler2D in_tex;
      out vec4 fragColor;
      void main() {
          fragColor = vec4(vec3(texture(in_tex, uv).xyz), 1.0);
      }
      """
    if flipy:
      fsSource = fsSource.replace("uv.y = 1.0 - uv.y;", "uv.y = uv.y;")
    if format:
      if format == "RGBA32UI":
        fsSource = fsSource.replace(
            "uniform sampler2D", "uniform usampler2D")
      elif format == "RGBA32F":
        pass
      else:
        raise "unknown format"

    VERTEX_SHADER = shaders.compileShader(vsSource, gl.GL_VERTEX_SHADER)

    FRAGMENT_SHADER = shaders.compileShader(fsSource, gl.GL_FRAGMENT_SHADER)

    program = shaders.compileProgram(VERTEX_SHADER, FRAGMENT_SHADER)

    gl.glUseProgram(program)

    triangleArray = gl.glGenVertexArrays(1)
    gl.glBindVertexArray(triangleArray)

    data = np.float32([-4, -4, 4, -4, 0, 4])

    positionBuffer = gl.glGenBuffers(1)
    gl.glBindBuffer(gl.GL_ARRAY_BUFFER, positionBuffer)
    gl.glBufferData(gl.GL_ARRAY_BUFFER, data, gl.GL_STATIC_DRAW)
    gl.glVertexAttribPointer(0, 2, gl.GL_FLOAT, False, 0, None)
    gl.glEnableVertexAttribArray(0)

    gl.glActiveTexture(gl.GL_TEXTURE0 + 0)
    gl.glBindTexture(gl.GL_TEXTURE_2D, tex)
    gl.glTexParameteri(
        gl.GL_TEXTURE_2D, gl.GL_TEXTURE_MIN_FILTER, gl.GL_NEAREST)
    gl.glTexParameteri(
        gl.GL_TEXTURE_2D, gl.GL_TEXTURE_MAG_FILTER, gl.GL_NEAREST)
    gl.glTexParameteri(
        gl.GL_TEXTURE_2D, gl.GL_TEXTURE_WRAP_S, gl.GL_CLAMP_TO_EDGE)
    gl.glTexParameteri(
        gl.GL_TEXTURE_2D, gl.GL_TEXTURE_WRAP_T, gl.GL_CLAMP_TO_EDGE)
    gl.glUniform1i(gl.glGetUniformLocation(program, "in_tex"), 0)

    gl.glDisable(gl.GL_CULL_FACE)
    gl.glFrontFace(gl.GL_CW)
    gl.glDisable(gl.GL_DEPTH_TEST)
    gl.glDisable(gl.GL_SCISSOR_TEST)
    gl.glDepthFunc(gl.GL_LEQUAL)
    gl.glDisable(gl.GL_BLEND)
    gl.glBlendFunc(gl.GL_ONE, gl.GL_ONE)
    gl.glDrawArrays(gl.GL_TRIANGLES, 0, 3)

    gl.glDeleteBuffers(1, positionBuffer)
    gl.glDeleteVertexArrays(1, triangleArray)
    gl.glDeleteProgram(program)

  def create_texture(self, data, width, height, format="RGBA8U"):
    texture = gl.glGenTextures(1)
    gl.glBindTexture(gl.GL_TEXTURE_2D, texture)
    assert(format == "RGBA8U")
    level = 0
    internalFormat = gl.GL_RGBA
    border = 0
    format = gl.GL_RGBA
    type = gl.GL_UNSIGNED_BYTE
    gl.glTexImage2D(gl.GL_TEXTURE_2D, level, internalFormat,
                    width, height, border,
                    format, type, data)
    return texture

  def render(self):
    """
    Evaluates the frame graph
    """
    pass

  def release(self):
    pass


global_state = GlobalState()
global_state.load_json("public/default_graph.json")


def showScreen():
  global global_state
  glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)
  gl.glClear(gl.GL_COLOR_BUFFER_BIT)
  try:
    tex = global_state.create_texture(np.uint8([
      255, 128, 0, 255,
      0, 128, 0, 255,
      0, 128, 170, 255,
      255, 128, 254, 255,
      ]), 2, 2)
    # global_state.render_triangle()
    global_state.render_texture(tex)
    img_buf = gl.glReadPixelsub(
        0, 0, WIDTH, HEIGHT, gl.GL_RGB, gl.GL_UNSIGNED_BYTE)
    img = np.frombuffer(img_buf, np.uint8).reshape(HEIGHT, WIDTH, 3)[::-1]
    fig, ax = plt.subplots()
    im = ax.imshow(img/255, interpolation='bilinear',
                   origin='upper')

    plt.show()
    glutSwapBuffers()
  except Exception as e:
    import traceback
    traceback.print_exc()
    print(e)
  exit()

glutInit()
glutInitDisplayMode(GLUT_RGBA)
glutInitWindowSize(WIDTH, HEIGHT)
glutInitWindowPosition(0, 0)
wind = glutCreateWindow("OpenGL Coding Practice")
glutDisplayFunc(showScreen)
glutIdleFunc(showScreen)
glutMainLoop()
