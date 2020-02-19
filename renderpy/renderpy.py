import numpy as np
import matplotlib.cm as cm
import matplotlib.pyplot as plt
import matplotlib.cbook as cbook
from matplotlib.path import Path
from matplotlib.patches import PathPatch
import json

import OpenGL
from OpenGL.GL import shaders
import OpenGL.GL as gl
from OpenGL.extensions import alternate
from OpenGL.GL.framebufferobjects import *
from OpenGL.GL.EXT.multi_draw_arrays import *
from OpenGL.GL.ARB.imaging import *

def glDrawBuffers(buf):
  try:
      gl.glDrawBuffers(buf)
  except OpenGL.GL.GLError as err:
    assert err.err == 1280

# Attribute dictionary
# used to hack python into making javascript like objects-dictionaries
class AD(dict):
  __getattr__ = dict.__getitem__
  __setattr__ = dict.__setitem__


def replace_dict(d):
  if isinstance(d, dict):
    d = AD(d)
    for key in d.keys():
      d[key] = replace_dict(d[key])
    return d
  elif isinstance(d, list):
    for i, item in enumerate(d):
      d[i] = replace_dict(item)
    return d
  else:
    return d


class Node:
  def __init__(self, global_state, json_node):
    self.id = json_node.id
    global_state.id2node[self.id] = self
    self.global_state = global_state
    self.title = json_node.title
    self.outputs = []
    self.inputs = []
    self.is_recursive = False
    for o in json_node.outputs:
      self.outputs.append(o)
    for o in json_node.inputs:
      self.inputs.append(o)
    self.properties = json_node.properties

  def get_output_by_name(self, name):
    i = 0
    for o in self.outputs:
      if o.name == name:
        return (i, o)
      i += 1
    return None

  def get_input_ids(self):
    out = set()
    for o in self.inputs:
      link_id = o.link
      if link_id:
        link = self.global_state.id2link[link_id]
        out.add(link.origin_node_id)
    return out

  def get_input_node_by_slot(self, slot):
    link_id = self.inputs[slot].link
    if link_id == None:
      return None
    link = self.global_state.id2link[link_id]
    return self.global_state.id2node[link.origin_node_id]

  def get_input_nodes(self):
    out = []
    for o in self.inputs:
      link_id = o.link
      if link_id:
        link = self.global_state.id2link[link_id]
        out.add(self.global_state.id2node[link.origin_node_id])
    return out

  def getInputNodeByName(self, name):
    for o in self.inputs:
      if o.name == name:
        link_id = o.link
        if link_id:
          link = self.global_state.id2link[link_id]
          return self.global_state.id2node[link.origin_node_id]
    return None

  def getInputLinkByName(self, name):
    for o in self.inputs:
      if o.name == name:
        link_id = o.link
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

  def get_uniform_location(self, name):
    return gl.glGetUniformLocation(self.gl.program, name)

  def gl_init(self):
    self.gl = AD()
    vs_source = self.global_state.get_src(self.properties.vs)
    ps_source = self.global_state.get_src(self.properties.ps)
    self.gl.program = shaders.compileProgram(shaders.compileShader(
        vs_source, gl.GL_VERTEX_SHADER), shaders.compileShader(ps_source, gl.GL_FRAGMENT_SHADER))

  def bind(self):
    gl.glUseProgram(self.gl.program)
    gl.glDisable(gl.GL_CULL_FACE)
    gl.glFrontFace(gl.GL_CW)
    gl.glDepthMask(True)
    gl.glEnable(gl.GL_DEPTH_TEST)
    gl.glDisable(gl.GL_SCISSOR_TEST)
    gl.glDepthFunc(gl.GL_LEQUAL)
    gl.glDisable(gl.GL_BLEND)
    gl.glBlendFunc(gl.GL_ONE, gl.GL_ONE)

  def get_attrib_location(self, name):
    return gl.glGetAttribLocation(self.gl.program, name)

  def gl_release(self):
    if self.gl.program != None:
      gl.glDeleteProgram(self.gl.program)
    self.gl = AD()

  def get_info(self):
    info = AD()
    info.attributes = self.properties.attributes
    info.uniforms = self.properties.uniforms
    return info


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

    gl.glBindFramebuffer(gl.GL_FRAMEBUFFER, 0)
    glDrawBuffers([gl.GL_BACK])
    gl.glViewport(0, 0, self.global_state.width, self.global_state.height)
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
    self.attributes = AD({})
    self.indices = AD({})
    pass

  def init(self, attributes, indices):
    self.attributes = attributes
    self.indices = indices

  def get_attrib_data(self, name):
    return self.attributes[name]

  def get_index_data(self):
    return self.indices

  def init_gltf(self, mesh):
    self.attributes.position = AD(data=np.float32(mesh.vertices.flatten()), type="vec3")
    self.attributes.normal = AD(data=np.float32(mesh.vertex_normals.flatten()), type="vec3")
    self.attributes.uv = AD(data=np.float32(mesh.visual.uv.flatten()), type="vec2")
    self.indices = AD(data=np.uint32(mesh.faces.flatten()), type="uint32")
    self.material = mesh.visual.material

class ModelNode(Node):
  def __init__(self, global_state, json_node):
    super().__init__(global_state, json_node)
    assert("fileurl" in self.properties)
    self.meshes = None

  def load(self):
    import trimesh
    self.meshes = []
    # from pygltflib import GLTF2, Scene
    # trimesh.util.attach_to_log()
    scene = trimesh.load(self.global_state.fileroot + 'models/LeePerrySmith/LeePerrySmith.gltf')
    # scene = trimesh.load(self.global_state.fileroot + 'head_lee_perry_smith/scene.gltf')
    for name, geom in scene.geometry.items():
      mesh = Mesh()
      mesh.init_gltf(geom)
      self.meshes.append(mesh)
    #   print (len(mesh.vertices))
    #   print (len(mesh.vertex_normals))
    #   print (len(mesh.faces))
    #   print (len(mesh.visual.uv))
    #   print (len(mesh.visual.material))
    #   print (mesh.visual)
    # scene.show()
    # filename = "public/models/head_lee_perry_smith/scene.gltf"
    # gltf = GLTF2().load(filename)
    # print(gltf.meshes[0].primitives[0].attributes)
    # exit()

  def get_meshes(self):
    if self.meshes == None:
      self.load()
    return self.meshes


class VertexBufferNode(Node):
  def __init__(self, global_state, json_node):
    super().__init__(global_state, json_node)
    assert("src" in self.properties)
    self.mesh = None

  def parse_src(self):
    if self.properties.src == None:
      return

    text = self.global_state.get_src(self.properties.src)
    if text == None:
      self.properties.src = None
      return

    json_dict = replace_dict(json.loads(text))
    mesh = Mesh()
    mesh.init(json_dict.attributes, json_dict.indices)
    self.mesh = mesh

  def get_meshes(self):
    if self.mesh == None:
      self.parse_src()
    return [self.mesh]


class TextureBufferNode(Node):
  def __init__(self, global_state, json_node):
    super().__init__(global_state, json_node)
    assert("src" in self.properties)

  def get_buffer(self, slot):
    return self.buf

  def parse_src(self):
    if self.properties.src == None:
      return

    text = self.global_state.get_src(self.properties.src)
    # print(text)
    if text == None:
      self.properties.src = None
      return

    self.buf = replace_dict(json.loads(text))

  def get_texture(self, loc):
    return self.gl.texture

  def gl_init(self):
    if not hasattr(self, "buf"):
      self.parse_src()
    if self.buf == None:
      return
    texture = gl.glGenTextures(1)
    self.gl = AD()
    self.gl.texture = texture
    gl.glBindTexture(gl.GL_TEXTURE_2D, texture)

    level = 0
    internalFormat = gl.GL_RGBA32F
    width = self.buf.width
    height = self.buf.height
    border = 0
    format = gl.GL_RGBA
    type = gl.GL_FLOAT
    data = None
    if self.buf.format == "RGBA32F":
      type = gl.GL_FLOAT
      internalFormat = gl.GL_RGBA32F
      format = gl.GL_RGBA
      data = np.float32(self.buf.data)
    elif self.buf.format == "RGBA32UI":
      type = gl.GL_UNSIGNED_INT
      internalFormat = gl.GL_RGBA32UI
      format = gl.GL_RGBA_INTEGER
      data = np.uint32(self.buf.data)
    else:
      raise 'Unsupported format. Please add!'

    gl.glTexImage2D(gl.GL_TEXTURE_2D, level, internalFormat, width, height, border,
                    format, type, data)

    # gl.glTexParameteri(gl.GL_TEXTURE_2D, gl.GL_TEXTURE_BASE_LEVEL, 0)
    # gl.glTexParameteri(gl.GL_TEXTURE_2D, gl.GL_TEXTURE_MAX_LEVEL, Math.log2(width))
    gl.glTexParameteri(
        gl.GL_TEXTURE_2D, gl.GL_TEXTURE_MIN_FILTER, gl.GL_NEAREST)
    gl.glTexParameteri(
        gl.GL_TEXTURE_2D, gl.GL_TEXTURE_MAG_FILTER, gl.GL_NEAREST)
    gl.glTexParameteri(
        gl.GL_TEXTURE_2D, gl.GL_TEXTURE_WRAP_S, gl.GL_CLAMP_TO_EDGE)
    gl.glTexParameteri(
        gl.GL_TEXTURE_2D, gl.GL_TEXTURE_WRAP_T, gl.GL_CLAMP_TO_EDGE)
    # gl.glGenerateMipmap(gl.GL_TEXTURE_2D)

  def gl_release(self):
    if hasattr(self, "gl") and self.gl.texture != None:
      gl.glDeleteTextures(1, self.gl.texture)
    self.gl = AD()


class DrawCallNode(Node):
  def __init__(self, global_state, json_node):
    super().__init__(global_state, json_node)
    self.gl = AD()
    self.attributes = []
    self.uniforms = []

  def gl_init(self):
    pipeline = self.getInputNodeByName("pipeline")
    assert(pipeline != None)
    pipeline_info = pipeline.get_info()
    self.attributes = pipeline_info.attributes
    self.uniforms = pipeline_info.uniforms

    mesh_input = self.getInputNodeByName("mesh")
    assert(mesh_input != None)
    self.gl = AD()
    self.gl.arrays = []
    self.gl.buffers = []
    meshes = mesh_input.get_meshes()
    for mesh in meshes:
      assert(mesh != None)
      mesh_info = AD()
      arr = gl.glGenVertexArrays(1)
      gl.glBindVertexArray(arr)

      for i, attrib in enumerate(self.attributes):
        out_attrib = mesh.get_attrib_data(attrib.name)
        assert(out_attrib != None)
        assert(out_attrib.type == attrib.type)
        data = out_attrib.data
        gl_buffer = gl.glGenBuffers(1)
        self.gl.buffers.append(gl_buffer)
        gl.glBindBuffer(gl.GL_ARRAY_BUFFER, gl_buffer)
        gl.glBufferData(gl.GL_ARRAY_BUFFER,
                        np.float32(data), gl.GL_STATIC_DRAW)
        loc = pipeline.get_attrib_location(attrib.name)
        if loc < 0:
          # print("[WARNING] Unused attribute:", attrib.name)
          continue
        comps = -1
        if attrib.type == "vec2":
          comps = 2
        elif attrib.type == "vec3":
          comps = 3
        else:
          raise "unrecognized type"

        gl.glVertexAttribPointer(loc, comps, gl.GL_FLOAT, False, 0, GLvoidp(0))
        gl.glEnableVertexAttribArray(loc)

      buf = mesh.get_index_data()
      assert("data" in buf)
      indexBuffer = gl.glGenBuffers(1)
      gl.glBindBuffer(gl.GL_ELEMENT_ARRAY_BUFFER, indexBuffer)
      self.gl.buffers.append(indexBuffer)
      # assert(buf.type == "uint32")
      gl.glBufferData(
          gl.GL_ELEMENT_ARRAY_BUFFER,
          np.uint32(buf.data),
          gl.GL_STATIC_DRAW
      )
      
      mesh_info.arr = arr
      mesh_info.draw_size = len(buf.data)

      mesh_info.index_type = gl.GL_UNSIGNED_INT
      self.gl.arrays.append(mesh_info)

  def gl_draw(self):
    pipeline = self.getInputNodeByName("pipeline")
    assert(pipeline != None)
    pipeline.bind()
    tu_cnt = 0

    if True:
      loc = pipeline.get_uniform_location("_resolution")
      if loc >= 0:
        viewport = gl.glGetIntegerv(gl.GL_VIEWPORT)
        gl.glUniform2fv(loc, 1, [viewport[2] - viewport[0],
                                 viewport[3] - viewport[1]])

    for i, uni in enumerate(self.uniforms):
      loc = pipeline.get_uniform_location(uni.name)
      if loc < 0:
        continue
      tu = tu_cnt
      if uni.type == "texture":
        gl.glActiveTexture(gl.GL_TEXTURE0 + tu)
        gl.glBindTexture(gl.GL_TEXTURE_2D, 0)
        gl.glUniform1i(loc, tu)
        tu_cnt += 1

      input = self.getInputNodeByName(uni.name)
      if input == None:
        continue
      input_link = self.getInputLinkByName(uni.name)
      if uni.type == "texture":
        texture = input.get_texture(input_link.origin_slot)
        gl.glActiveTexture(gl.GL_TEXTURE0 + tu)
        gl.glBindTexture(gl.GL_TEXTURE_2D, texture)
        gl.glTexParameteri(
            gl.GL_TEXTURE_2D, gl.GL_TEXTURE_MIN_FILTER, gl.GL_NEAREST)
        gl.glTexParameteri(
            gl.GL_TEXTURE_2D, gl.GL_TEXTURE_MAG_FILTER, gl.GL_NEAREST)
        gl.glTexParameteri(
            gl.GL_TEXTURE_2D, gl.GL_TEXTURE_WRAP_S, gl.GL_CLAMP_TO_EDGE)
        gl.glTexParameteri(
            gl.GL_TEXTURE_2D, gl.GL_TEXTURE_WRAP_T, gl.GL_CLAMP_TO_EDGE)
        gl.glUniform1i(loc, tu)
      else:
        val = input.get_value(input_link.origin_slot)
        if uni.type == "int":
          gl.glUniform1i(loc, val)
        else:
          raise "Unimplemented"

    for arr in self.gl.arrays:
      gl.glBindVertexArray(arr.arr)
      gl.glDrawElements(gl.GL_TRIANGLES, arr.draw_size, arr.index_type, None)

  def gl_release(self):
    for arr in self.gl.arrays:
      gl.glDeleteVertexArrays(1, arr.arr)
    for buf in self.gl.buffers:
      gl.glDeleteBuffers(1, buf)
    self.gl = AD()


class FeedbackNode(Node):
  def __init__(self, global_state, json_node):
    super().__init__(global_state, json_node)
    self.is_recursive = True
    self.gl = AD()
    self.gl.tex = None

  def reset(self):
    if self.gl.tex != None:
      gl.glDeleteTextures(1, self.gl.tex)
    self.gl.tex = gl.glGenTextures(1)
    gl.glBindTexture(gl.GL_TEXTURE_2D, self.gl.tex)
    gl.glTexStorage2D(gl.GL_TEXTURE_2D, 1, gl.GL_RGBA8, 1, 1)

  def get_texture(self, slot):
    if self.gl.tex == None:
      self.reset()
    return self.gl.tex

  def gl_render(self):
    if self.gl.tex != None:
      gl.glDeleteTextures(1, self.gl.tex)
    self.gl = AD(tex=None)
    input_link = self.getInputLinkByName("in")
    if input_link == None:
      return
    self.gl.tex = self.getInputNodeByName(
        "in").clone_texture(input_link.origin_slot)


class PassNodeGL:
  def __init__(self):
    self.fb = None
    self.rts = []
    self.depth = None
    self.draw_buffers = []


class PassNode(Node):
  def __init__(self, global_state, json_node):
    super().__init__(global_state, json_node)
    self.gl = PassNodeGL()
    assert("viewport" in self.properties and (
        "rts" in self.properties or "depth" in self.properties))

  def gl_render(self):
    gl.glPushDebugGroup(gl.GL_DEBUG_SOURCE_APPLICATION, 0, 4, "Pass")
    self.bind()
    for i, input in enumerate(self.inputs):
      if input["type"] == "drawcall_t":
        node = self.get_input_node_by_slot(i)
        if node != None:
          node.gl_draw()
    gl.glPopDebugGroup()

  def gl_init(self):
    self.gl = PassNodeGL()
    self.gl.fb = gl.glGenFramebuffers(1)
    gl.glBindFramebuffer(gl.GL_FRAMEBUFFER, self.gl.fb)
    for i in range(0, len(self.properties.rts)):
      tex = self.gen_texture(i)
      self.gl.rts.append(tex)
      self.gl.draw_buffers.append(gl.GL_COLOR_ATTACHMENT0 + i)
      gl.glFramebufferTexture2D(
          gl.GL_FRAMEBUFFER, gl.GL_COLOR_ATTACHMENT0 + i, gl.GL_TEXTURE_2D, tex, 0)

    if self.properties.depth != None:
      tex = self.gen_texture(999)
      self.gl.depth = tex
      gl.glFramebufferTexture2D(
          gl.GL_FRAMEBUFFER, gl.GL_DEPTH_ATTACHMENT, gl.GL_TEXTURE_2D, tex, 0)

  def clone_texture(self, id):
    targetTextureWidth = self.properties.viewport.width
    targetTextureHeight = self.properties.viewport.height
    targetTexture = self.gen_texture(id)
    srcTexture = self.get_texture(id)
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
    glDrawBuffers([gl.GL_COLOR_ATTACHMENT0])
    gl.glViewport(0, 0, targetTextureWidth, targetTextureHeight)
    gl.glClearColor(0, 0, 1, 1)
    gl.glClear(gl.GL_COLOR_BUFFER_BIT | gl.GL_DEPTH_BUFFER_BIT)

    global_state.render_texture(srcTexture)

    gl.glDeleteFramebuffers(1, fb)
    return targetTexture

  def gen_texture(self, id):
    if id >= len(self.properties.rts):
      rt = self.properties.depth
      tex = gl.glGenTextures(1)
      gl.glBindTexture(gl.GL_TEXTURE_2D, tex)
      format = None
      if rt.format == "D16":
        format = gl.GL_DEPTH_COMPONENT16
      elif rt.format == "D32":
        format = gl.GL_DEPTH_COMPONENT32F
      else:
        raise "unknown format"

      gl.glTexStorage2D(gl.GL_TEXTURE_2D, 1, format,
                        self.properties.viewport.width, self.properties.viewport.height)
      return tex
    else:
      rt = self.properties.rts[id]
      tex = gl.glGenTextures(1)
      gl.glBindTexture(gl.GL_TEXTURE_2D, tex)
      format = None
      if rt.format == "RGBA8":
        format = gl.GL_RGBA8
      elif rt.format == "RGBA32F":
        format = gl.GL_RGBA32F
      else:
        raise "unknown format"
      gl.glTexStorage2D(gl.GL_TEXTURE_2D, 1, format,
                        self.properties.viewport.width, self.properties.viewport.height)
      return tex

  def get_texture(self, id):
    if id >= len(self.properties.rts):
      return self.gl.depth
    return self.gl.rts[id]

  def bind(self):
    gl.glBindFramebuffer(gl.GL_FRAMEBUFFER, self.gl.fb)
    glDrawBuffers(self.gl.draw_buffers)
    gl.glViewport(0, 0, self.properties.viewport.width,
                  self.properties.viewport.height)
    gl.glClearColor(0, 0, 0, 1)
    gl.glClearDepth(1.0)
    gl.glClear(gl.GL_COLOR_BUFFER_BIT | gl.GL_DEPTH_BUFFER_BIT)

  def gl_release(self):
    if self.gl.fb != None:
      gl.glDeleteFramebuffers(1, self.gl.fb)

    for i in range(0, len(self.gl.rts)):
      tex = self.gl.rts[i]
      gl.glDeleteTextures(1, tex)

    if self.gl.depth != None:
      gl.glDeleteTextures(1, self.gl.depth)

    self.gl = PassNodeGL()


class GlobalState:
  def __init__(self):
    self.nodes = []
    self.id2node = {}
    self.links = []
    self.id2link = {}
    self.frame_count = 0
    self.width = 512
    self.height = 512
    self.fileroot = "public/"
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

  def get_src(self, name):
    return self.json.config.srcs[name].code

  def load_json(self, filename):
    self.json = replace_dict(json.load(open(filename)))
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
      vsSource = vsSource.replace("uv.y = 1.0 - uv.y;", "uv.y = uv.y;")

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
    glDrawBuffers([gl.GL_COLOR_ATTACHMENT0])
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


# import OpenGL.GLUT as glut


if __name__ == '__main__':
  import OpenGL.GLU as glu
  import OpenGL.GLUT as glut
  global_state = GlobalState()
  global_state.load_json("public/default_graph.json")
  def showScreen():
    global global_state
    gl.glClear(gl.GL_COLOR_BUFFER_BIT | gl.GL_DEPTH_BUFFER_BIT)
    try:
      # tex = global_state.create_texture(np.uint8([
      #     255, 128, 0, 255,
      #     0, 128, 0, 255,
      #     0, 128, 170, 255,
      #     255, 128, 254, 255,
      # ]), 2, 2)
      # global_state.render_triangle()
      global_state.render()
      # print(gl.glGetError())
      # gl.glDrawBuffers([int(gl.GL_COLOR_ATTACHMENT0)])
      # gl.glClear(gl.GL_COLOR_BUFFER_BIT)
      # gl.glBegin(gl.GL_TRIANGLES)
      # gl.glColor3f(1.0, 0.0, 0.0)
      # gl.glVertex2f(0,  1)
      # gl.glColor3f(0.0, 1.0, 0.0)
      # gl.glVertex2f(-1, -1)
      # gl.glColor3f(0.0, 0.0, 1.0)
      # gl.glVertex2f(1, -1)
      # gl.glEnd()
      # img_buf = gl.glReadPixelsub(
      #     0, 0, global_state.width, global_state.height, gl.GL_RGB, gl.GL_UNSIGNED_BYTE)
      # img = np.frombuffer(img_buf, np.uint8).reshape(global_state.width, global_state.height, 3)[::-1]
      # fig, ax = plt.subplots()
      # im = ax.imshow(img/255, interpolation='bilinear',
      #                origin='upper')
      # # im = ax.imshow(global_state.get_texture_data(tex, "RGBA8UN", 2, 2)/255, interpolation='bilinear',
      # #                origin='upper')

      # plt.show()

      glut.glutSwapBuffers()
    except Exception as e:
      import traceback
      traceback.print_exc()
      print(e)
  glut.glutInit()
  glut.glutInitContextVersion(4, 5)
  glut.glutInitContextFlags(glut.GLUT_FORWARD_COMPATIBLE)
  glut.glutInitContextProfile(glut.GLUT_CORE_PROFILE)
  glut.glutInitDisplayMode(glut.GLUT_RGBA | glut.GLUT_DOUBLE | glut.GLUT_DEPTH)
  glut.glutInitWindowSize(global_state.width, global_state.height)
  glut.glutInitWindowPosition(0, 0)
  wind = glut.glutCreateWindow("OpenGL Coding Practice")
  glut.glutDisplayFunc(showScreen)
  glut.glutIdleFunc(showScreen)
  print(gl.glGetString(gl.GL_VERSION))
  print(gl.glGetString(gl.GL_VENDOR))

  glut.glutMainLoop()
# import unittest, pygame, pygame.display, time, os
# import logging 
# logging.basicConfig(level=logging.INFO)
# HERE = os.path.dirname( __file__ )
# import pickle
# try:
#     import cPickle
# except ImportError as err:
#     cPickle = pickle

# try:
#     from numpy import *
# except ImportError as err:
#     array = None

# pygame.display.init()
# import OpenGL
# import OpenGL.GL as gl
# if os.environ.get( 'TEST_NO_ACCELERATE' ):
#     OpenGL.USE_ACCELERATE = False
# #OpenGL.FULL_LOGGING = True
# OpenGL.CONTEXT_CHECKING = True
# OpenGL.FORWARD_COMPATIBLE_ONLY = False
# OpenGL.UNSIGNED_BYTE_IMAGES_AS_STRING = True

#     #raise RuntimeError( """Did not catch invalid context!""" )
# #from OpenGL import error
# from OpenGL.GLU import *
# #from OpenGL.arrays import arraydatatype

# from OpenGL.extensions import alternate
# #import ctypes
# from OpenGL.GL.framebufferobjects import *
# from OpenGL.GL.EXT.multi_draw_arrays import *
# from OpenGL.GL.ARB.imaging import *

# width = height = 300
# screen = pygame.display.set_mode(
#     (width,height),
#     pygame.OPENGL | pygame.DOUBLEBUF,
# )

# pygame.display.set_caption('Testing system')
# pygame.key.set_repeat(500,30)

# print(gl.glGetString(gl.GL_VERSION))
# print(gl.glGetString(gl.GL_VENDOR))



# while True:
#   try:
#     gl.glDrawBuffers([gl.GL_FRONT])
#   except GLError as err:
#     assert err.err == 1280
#   gl.glClear(gl.GL_COLOR_BUFFER_BIT)
#   gl.glBegin(gl.GL_TRIANGLES)
#   gl.glColor3f(1.0, 0.0, 0.0)
#   gl.glVertex2f(0,  1)
#   gl.glColor3f(0.0, 1.0, 0.0)
#   gl.glVertex2f(-1, -1)
#   gl.glColor3f(0.0, 0.0, 1.0)
#   gl.glVertex2f(1, -1)
#   gl.glEnd()
#   gl.glFlush()
#   pygame.display.flip()
# #
