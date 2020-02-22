import re
import sys
file = open(sys.argv[1])
contents = file.read()
out = ""
pattern = re.compile(r'gl\.')
pattern1 = re.compile(r'\(|\)|\_')
replace_list = []
for match in pattern.finditer(contents):
  # print(match.span())
  s = match.span()
  # print(line[s[0]:s[1]])
  next_two = contents[s[1]:s[1]+2]
  if next_two == "gl":
    continue

  paren_pos = -1

  for parenth_match in pattern1.finditer(contents[s[1]:]):
    paren_pos = s[1] + parenth_match.span()[0]
    break

  if paren_pos < 0:
    continue

  next_letter = contents[s[1]:s[1]+1]

  if next_letter[0].isupper():
    new_item = "gl.GL_" + contents[s[1]:paren_pos]
    replace_list.append([contents[s[0]:paren_pos], new_item])
    continue

  # print(paren_pos)
  

  new_item = "gl.gl" + next_letter.upper() + contents[s[1]+1:paren_pos]
  replace_list.append([contents[s[0]:paren_pos], new_item])
  # print(line[s[1]:s[1]+1])
# print(replace_list)

replace_list.append(["`", "\"\"\""])
replace_list.append(["//", "#"])
replace_list.append(["var ", ""])
replace_list.append(["let ", ""])
replace_list.append(["const ", ""])
replace_list.append(["null ", "None"])
replace_list.append(["null", "None"])
replace_list.append(["false", "False"])
replace_list.append(["this", "self"])
replace_list.append(["true", "True"])
replace_list.append([";", ""])
replace_list.append(["console.error", "print"])
replace_list.append(["console.log", "print"])
replace_list.append(["=>", ":"])
replace_list.append(["{", ""])
replace_list.append(["}", ""])
replace_list.append(["new Float32Array", "np.float32"])
replace_list.append(["glCreateBuffer()", "glGenBuffers(1)"])
replace_list.append(["glCreateTexture()", "glGenTextures(1)"])
replace_list.append(["glCreateFramebuffer()", "glGenFramebuffers(1)"])
replace_list.append(["glCreateVertexArray()", "glGenVertexArrays(1)"])
replace_list.append(["glDeleteBuffer(", "glDeleteBuffers(1, "])
replace_list.append(["glDeleteVertexArray(", "glDeleteVertexArrays(1, "])
replace_list.append(["glDeleteTexture(", "glDeleteTextures(1, "])
replace_list.append(["glDeleteFramebuffer(", "glDeleteFramebuffers(1, "])
replace_list.append(["deleteVertexArray(", "glDeleteVertexArrays(1, "])

for pat in replace_list:
  contents = contents.replace(pat[0], pat[1])

print(contents)
