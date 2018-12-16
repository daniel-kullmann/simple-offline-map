package main

import (
	"fmt"
	"github.com/gorilla/mux"
	"log"
	"net/http"
	"os"
	"strings"
)

const TileBase = "../tile_cache/"

func GetTile(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	s := vars["s"]
	z := vars["z"]
	x := vars["x"]
	y := vars["y"] + ".png"
	dirName := TileBase + strings.Join([]string{s, z, x}, "/")
	fileName := TileBase + strings.Join([]string{s, z, x, y}, "/")
	if _, err := os.Stat(fileName); os.IsNotExist(err) {

		log.Print(fileName + ": fetch from OSM")
		url := fmt.Sprintf("https://%s.tile.openstreetmap.org/%s/%s/%s", s, z, x, y)
		ua := r.Header.Get("User-Agent")
		client := http.Client{}
		request, err := http.NewRequest("GET", url, nil)
		if err != nil {
			w.Header().Add("Content-Type", "text/plain")
			w.WriteHeader(404)
			//w.Write(err.String())
		}
		request.Header.Set("User-Agent", ua)
		response, err := client.Do(request)
		if err != nil {
			w.Header().Add("Content-Type", "text/plain")
			w.WriteHeader(404)
			response.Body.Close()
			log.Print("ERROR: Can't make request to " + url)
		} else if response.StatusCode != 200 {
			w.Header().Add("Content-Type", "text/plain")
			w.WriteHeader(404)
			w.Write([]byte(response.Status))
			response.Body.Close()
			log.Print("ERROR: Request resulted in " + response.Status + ", " + url)
		} else {
			w.Header().Add("Content-Type", "image/png")
			w.Header().Add("Access-Control-Allow-Origin", "*")
			err = os.MkdirAll(dirName, 0777)
			if err != nil {
				log.Print("Can't create output dir " + dirName)
			}
			fh, err_fh := os.Create(fileName)
			if err_fh != nil {
				log.Print("Can't create output file " + fileName)
			}
			size := 0
			buffer := make([]uint8, 100*1024)
			for {
				count, err := response.Body.Read(buffer)
				if err != nil || count == 0 {
					break
				}
				size += count
				if err_fh == nil {
					fh.Write(buffer[0:count])
				}
			}
			fh.Close()
			response.Body.Close()
			log.Printf("Finished retrieving %s: %d", fileName, size)
		}
	} else {
		w.Header().Add("Content-Type", "image/png")
		w.Header().Add("Access-Control-Allow-Origin", "*")
		log.Print(fileName + ": locally cached")
		fh, err := os.Open(fileName)
		if err != nil {
			w.Header().Add("Content-Type", "text/plain")
			w.WriteHeader(404)
			log.Print("ERROR: Can't read file " + fileName)
		}
		buffer := make([]uint8, 100*1024)
		for count, err := fh.Read(buffer); err == nil && count != 0; count, err = fh.Read(buffer) {
			w.Write(buffer[0:count])
		}
	}

}
