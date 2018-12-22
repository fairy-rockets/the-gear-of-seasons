package main

import (
	"flag"
	_ "image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io/ioutil"
	"os"
	"path/filepath"
	"strconv"

	"gopkg.in/yaml.v2"

	"github.com/fairy-rockets/the-gear-of-seasons/shelf"

	"github.com/fairy-rockets/the-gear-of-seasons/cmds/converter/old-shelf"

	log "github.com/Sirupsen/logrus"
	"github.com/fatih/color"
)

//go:generate bash ../geninfo.sh

func printLogo() {
	log.Info(color.MagentaString("%s", gitRev()))
	log.Infof("Build at: %s", color.MagentaString("%s", buildAt()))
}

func export(path string, entity shelf.Entity) {
	_, err := os.Stat(path)
	if err != nil {
		log.Fatal(err)
	}
	dat, err := yaml.Marshal(entity)
	if err != nil {
		log.Fatal(err)
	}
	err = ioutil.WriteFile(path, dat, 0644)
	if err != nil {
		log.Fatal(err)
	}
}

func main() {
	flag.Parse()
	var err error
	printLogo()

	sh := old_shelf.NewEntityShelf("_shelf/entity")
	err = sh.Init()
	if err != nil {
		log.Fatal(err)
	}
	for _, ent := range sh.AsSlice() {
		switch v := ent.(type) {
		case *old_shelf.ImageEntity:
			n := shelf.ImageEntity{}
			n.ID_ = v.ID
			n.Path_ = v.Path
			n.MimeType_ = v.MimeType
			n.Date_ = v.Date
			n.Description_ = v.Description
			n.Height = v.Height
			n.Width = v.Width
			export(filepath.Join("_shelf/entity", strconv.Itoa(n.Date().Year()), n.ID()+".image.yml"), &n)
		case *old_shelf.VideoEntity:
			n := shelf.VideoEntity{}
			n.ID_ = v.ID
			n.Path_ = v.Path
			n.MimeType_ = v.MimeType
			n.Date_ = v.Date
			n.Description_ = v.Description
			n.Height = v.Height
			n.Width = v.Width
			export(filepath.Join("_shelf/entity", strconv.Itoa(n.Date().Year()), n.ID()+".video.yml"), &n)
		case *old_shelf.AudioEntity:
			n := shelf.AudioEntity{}
			n.ID_ = v.ID
			n.Path_ = v.Path
			n.MimeType_ = v.MimeType
			n.Date_ = v.Date
			n.Description_ = v.Description
			export(filepath.Join("_shelf/entity", strconv.Itoa(n.Date().Year()), n.ID()+".audio.yml"), &n)
		}
	}
}
