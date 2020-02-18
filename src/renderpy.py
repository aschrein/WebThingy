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

  def render_texture(self, tex, format="RGBA32F", flipy=False):
    """
    Renders a fullscreen quad with the given texture
    """
    pass

  def render(self):
    """
    Evaluates the frame graph
    """
    pass

  def release(self):
    pass


global_state = GlobalState()
global_state.load_json("../public/default_graph.json")


def showScreen():
  global global_state
  # Remove everything from screen (i.e. displays all white)
  glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)
  glLoadIdentity()  # Reset all graphic/shape's position
  gl.glClear(gl.GL_COLOR_BUFFER_BIT)
  gl.glBegin(gl.GL_TRIANGLES)
  gl.glColor3f(1.0, 0.0, 0.0)
  gl.glVertex2f(0,  1)
  gl.glColor3f(0.0, 1.0, 0.0)
  gl.glVertex2f(-1, -1)
  gl.glColor3f(0.0, 0.0, 1.0)
  gl.glVertex2f(1, -1)
  gl.glEnd()

  global_state.render()
  # Read the result
  img_buf = gl.glReadPixelsub(
      0, 0, WIDTH, HEIGHT, gl.GL_RGB, gl.GL_UNSIGNED_BYTE)
  img = np.frombuffer(img_buf, np.uint8).reshape(HEIGHT, WIDTH, 3)[::-1]
  fig, ax = plt.subplots()
  im = ax.imshow(img/255, interpolation='bilinear',
                 origin='upper')

  plt.show()
  # show.image(img/255.0)
  glutSwapBuffers()
  exit()

# ---Section 3---


glutInit()
glutInitDisplayMode(GLUT_RGBA)  # Set the display mode to be colored
glutInitWindowSize(WIDTH, HEIGHT)   # Set the w and h of your window
# Set the position at which this windows should appear
glutInitWindowPosition(0, 0)
wind = glutCreateWindow("OpenGL Coding Practice")  # Set a window title
glutDisplayFunc(showScreen)
glutIdleFunc(showScreen)  # Keeps the window open
glutMainLoop()  # Keeps the above created window displaying/running in a loop
