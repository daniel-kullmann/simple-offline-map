from django.shortcuts import render
from django.http import HttpResponse

import http.client
import os
import os.path
import ssl

context = None

def get_tile(request,s,z,x,y):
    dirname = "tile_cache/" + s + "/" + z + "/" + x
    filename = dirname + "/" + y + ".png"
    if os.path.exists(filename):
        with open(filename, "rb") as fh:
            response = HttpResponse(fh, content_type='image/png')
            response['Access-Control-Allow-Origin'] = '*'
            return response

    global context
    if context == None:
        context = ssl.create_default_context()
    connection = http.client.HTTPSConnection(s + ".tile.openstreetmap.org", context=context)
    connection.request('GET', "/"+z+"/"+x+"/"+y+".png")
    response = connection.getresponse()
    if response.status != 200:
        return None # TODO
    png = response.read()
    if len(png) > 0:
        os.makedirs(dirname, exist_ok=True)
        with open(filename, "wb") as fh:
            fh.write(png)
    response = HttpResponse(png, content_type='image/png')
    response['Access-Control-Allow-Origin'] = '*'
    return response