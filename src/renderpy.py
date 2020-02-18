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
    global_state.id2node[self.id] = self
    self.global_state = global_state
    self.title = json_node["title"]
    self.outputs = []
    self.inputs = []
    self.is_recursive = False
    for o in json_node["outputs"]:
      self.outputs.append(o)
    for o in json_node["inputs"]:
      self.inputs.append(o)
    self.properties = json_node["properties"]

  def get_output_by_name(self, name):
    i = 0
    for o in self.outputs:
      if o["name"] == name:
        return (i, o)
      i += 1
    return None

  def get_input_ids(self):
    out = set()
    for o in self.inputs:
      link_id = o["link"]
      if link_id:
        link = self.global_state.id2link[link_id]
        out.add(link.origin_node_id)
    return out

  def get_input_node_by_slot(self, slot):
    link_id = self.inputs[slot]["link"]
    link = self.global_state.id2link[link_id]
    return self.global_state.id2node[link.origin_node_id]

  def get_input_nodes(self):
    out = []
    for o in self.inputs:
      link_id = o["link"]
      if link_id:
        link = self.global_state.id2link[link_id]
        out.add(self.global_state.id2node[link.origin_node_id])
    return out

  def getInputNodeByName(self, name):
    for o in self.inputs:
      if o["name"] == name:
        link_id = o["link"]
        if link_id:
          link = self.global_state.id2link[link_id]
          return self.global_state.id2node[link.origin_node_id]
    return None

  def getInputLinkByName(self, name):
    for o in self.inputs:
      if o["name"] == name:
        link_id = o["link"]
        if link_id:
          return self.global_state.id2link[link_id]
    return None


class Link:
  def __init__(self, global_state, json_node):
    self.id = json_node[0]
    global_state.id2link[self.id] = self
    self.global_state = global_state
    self.origin_node_id = json_node[1]
    self.origin_slot = json_node[2]
    self.target_node_id = json_node[3]
    self.target_slot_id = json_node[4]


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

  def gl_render(self):
    in_node = self.getInputNodeByName("in")
    if in_node == None:
      return
    input_link = self.getInputLinkByName("in")
    tex = in_node.get_texture(input_link.origin_slot)

    gl.glDisable(gl.GL_CULL_FACE)
    gl.glDisable(gl.GL_DEPTH_TEST)
    gl.glDisable(gl.GL_DEPTH_TEST)
    gl.glDisable(gl.GL_SCISSOR_TEST)
    gl.glDepthFunc(gl.GL_LEQUAL)
    gl.glBlendFunc(gl.GL_ONE, gl.GL_ONE)

    gl.glBindFramebuffer(gl.GL_FRAMEBUFFER, null)
    gl.glDrawBuffers([gl.GL_BACK])
    gl.glViewport(0, 0, global_state.width, global_state.height)
    gl.glClearColor(0, 0, 1, 1)
    gl.glClear(gl.GL_COLOR_BUFFER_BIT | gl.GL_DEPTH_BUFFER_BIT)
    global_state.render_texture(tex, "RGBA32F", True)


class FrameCountNode(Node):
  def __init__(self, global_state, json_node):
    super().__init__(global_state, json_node)

  def get_value(self, slot):
    return self.global_state.frame_count


class Mesh:
  def __init__(self):
    pass

  def get_attrib_data(self, name):
    return {"data": np.float32([1.0, 0.0, 0.0]), "type": "vec3"}

  def get_index_data(self):
    return {"data": np.uint32([0, 1, 2]), "type": "uint32"}


class ModelNode(Node):
  def __init__(self, global_state, json_node):
    super().__init__(global_state, json_node)
    assert("fileurl" in self.properties)

  def get_meshes(self):
    return []


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
    self.is_recursive = True


class PassNode(Node):
  def __init__(self, global_state, json_node):
    super().__init__(global_state, json_node)
    assert("viewport" in self.properties and (
        "rts" in self.properties or "depth" in self.properties))

  def gl_render(self):
    self.bind(gl)
    for i, input in enumerate(self.inputs):
      if input["type"] == "drawcall_t":
        node = get_input_node_by_slot(i)
        node.gl_draw()


class GlobalState:
  def __init__(self):
    self.nodes = []
    self.id2node = {}
    self.links = []
    self.id2link = {}
    self.frame_count = 0
    pass

  def toposort(self):
    """
    Returns the list of nodes in inverse topological order
    """
    sorted = []
    unsorted = []
    unsorted_set = set()
    for node in self.nodes:
      if node.is_recursive:
        continue
      unsorted_set.add(node.id)
      unsorted.append(node)
    while len(unsorted_set) != 0:
      node = unsorted.pop(0)
      is_ready = True
      for id in node.get_input_ids():
        if id in unsorted_set:
          is_ready = False
          break
      if is_ready:
        sorted.append(node)
        unsorted_set.remove(node.id)
      else:
        unsorted.append(node)
    for node in self.nodes:
      if node.is_recursive:
        sorted.append(node)
    return sorted

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

    for json_link in self.json["links"]:
      self.links.append(Link(self, json_link))

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
      elif format == "RGBA8UN":
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

  def create_texture(self, data, width, height, format="RGBA8UN"):
    texture = gl.glGenTextures(1)
    gl.glBindTexture(gl.GL_TEXTURE_2D, texture)
    assert(format == "RGBA8UN")
    level = 0
    internalFormat = gl.GL_RGBA
    border = 0
    format = gl.GL_RGBA
    type = gl.GL_UNSIGNED_BYTE
    gl.glTexImage2D(gl.GL_TEXTURE_2D, level, internalFormat,
                    width, height, border,
                    format, type, data)
    return texture

  def get_texture_data(self, tex, format, width, height):
    targetTexture = gl.glGenTextures(1)
    gl.glBindTexture(gl.GL_TEXTURE_2D, targetTexture)

    gl.glTexImage2D(gl.GL_TEXTURE_2D, 0, gl.GL_RGBA,
                    width, height, 0,
                    gl.GL_RGBA, gl.GL_UNSIGNED_BYTE, None)

    # set the filtering so we don't need mips
    gl.glTexParameteri(
        gl.GL_TEXTURE_2D, gl.GL_TEXTURE_MIN_FILTER, gl.GL_LINEAR)
    gl.glTexParameteri(
        gl.GL_TEXTURE_2D, gl.GL_TEXTURE_WRAP_S, gl.GL_CLAMP_TO_EDGE)
    gl.glTexParameteri(
        gl.GL_TEXTURE_2D, gl.GL_TEXTURE_WRAP_T, gl.GL_CLAMP_TO_EDGE)

    # Create and bind the framebuffer
    fb = gl.glGenFramebuffers(1)
    gl.glBindFramebuffer(gl.GL_FRAMEBUFFER, fb)
    gl.glFramebufferTexture2D(
        gl.GL_FRAMEBUFFER, gl.GL_COLOR_ATTACHMENT0, gl.GL_TEXTURE_2D, targetTexture, 0)

    gl.glDisable(gl.GL_CULL_FACE)
    gl.glDisable(gl.GL_DEPTH_TEST)
    gl.glDisable(gl.GL_DEPTH_TEST)
    gl.glDisable(gl.GL_SCISSOR_TEST)
    gl.glDepthFunc(gl.GL_LEQUAL)
    gl.glBlendFunc(gl.GL_ONE, gl.GL_ONE)

    gl.glBindFramebuffer(gl.GL_FRAMEBUFFER, fb)
    gl.glDrawBuffers([gl.GL_COLOR_ATTACHMENT0])
    gl.glViewport(0, 0, width, height)
    gl.glClearColor(0, 0, 1, 1)
    gl.glClear(gl.GL_COLOR_BUFFER_BIT | gl.GL_DEPTH_BUFFER_BIT)

    self.render_texture(tex, format)

    img_buf = gl.glReadPixelsub(
        0, 0, width, height, gl.GL_RGBA, gl.GL_UNSIGNED_BYTE)
    img = np.frombuffer(img_buf, np.uint8).reshape(height, width, 4)[::-1]

    gl.glDeleteFramebuffers(1, fb)
    gl.glDeleteTextures(1, targetTexture)
    return img

  def render(self):
    """
    Evaluates the frame graph
    """
    sorted = self.toposort()
    for node in sorted:
      if hasattr(node, 'gl_init'):
        node.gl_init()
    for node in sorted:
      if hasattr(node, 'gl_render'):
        node.gl_render()
    for node in reversed(sorted):
      if hasattr(node, 'gl_release'):
        node.gl_release()
    self.frame_count += 1
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
    # tex = global_state.create_texture(np.uint8([
    #     255, 128, 0, 255,
    #     0, 128, 0, 255,
    #     0, 128, 170, 255,
    #     255, 128, 254, 255,
    # ]), 2, 2)
    # global_state.render_triangle()
    global_state.render()
    img_buf = gl.glReadPixelsub(
        0, 0, WIDTH, HEIGHT, gl.GL_RGB, gl.GL_UNSIGNED_BYTE)
    img = np.frombuffer(img_buf, np.uint8).reshape(HEIGHT, WIDTH, 3)[::-1]
    fig, ax = plt.subplots()
    im = ax.imshow(img/255, interpolation='bilinear',
                   origin='upper')
    # im = ax.imshow(global_state.get_texture_data(tex, "RGBA8UN", 2, 2)/255, interpolation='bilinear',
    #                origin='upper')

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
