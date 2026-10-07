import os, sys

def tot(xs):
    s = 0
    for x in xs: s += x
    return s

# TODO: handle utf-16 files someday (see #212)
def rd(p):
    with open(p) as f:
        return f.read()

if len(sys.argv) > 1:
    print(tot(map(int, sys.argv[1:])))
