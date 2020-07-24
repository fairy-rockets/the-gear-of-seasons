package main

import (
	"crypto/md5"
	"encoding/hex"
	"flag"
	_ "image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"os"
	"reflect"

	"github.com/fairy-rockets/the-gear-of-seasons/pkg/fml"

	log "github.com/sirupsen/logrus"

	shelfPkg "github.com/fairy-rockets/the-gear-of-seasons/internal/shelf"
	"github.com/fatih/color"
)

//go:generate bash ../../scripts/geninfo.sh

var shelfPath = flag.String("shelf", "_shelf", "shelf path")

var shelf *shelfPkg.Shelf

func printLogo() {
	log.Info("****************************************")
	log.Info(color.BlueString("  the-gear-of-seasons  "))
	log.Info("****************************************")
	log.Info(color.MagentaString("%s", gitRev()))
	log.Infof("Build at: %s", color.MagentaString("%s", buildAt()))
}

func main() {
	//var err error

	printLogo()
	flag.Parse()
	log.Info("----------------------------------------")
	log.Info("Initializing...")
	storage, err := shelfPkg.NewStorage(*shelfPath)
	if err != nil {
		log.Fatalf("Failed to prepare storage: %v", err)
	}
	shelf = shelfPkg.New(storage)
	if err := shelf.Init(); err != nil {
		log.Fatalf("Failed to prepare shelf: %v", err)
	}
	log.Infof("%d entities, %d moments", shelf.NumEntities(), shelf.NumMoments())

	entities := shelf.FindAllEntities()
	moments := shelf.FindAllMoments()

	log.Info(color.GreenString("[OK]"))
	{
		log.Info("----------------------------------------")
		log.Info("Checking Entities...")
		percent := 0
		for i, ent := range entities {
			checkEntity(ent)
			percentNext := int(100.0 * float64(i+1) / float64(len(entities)))
			if percentNext > percent {
				percent = percentNext
				log.Infof("%d/%d(%d%%) ...", i+1, len(entities), percent)
			}
		}
		log.Info(color.GreenString("[OK]"))
	}
	{
		log.Info("----------------------------------------")
		log.Info("Checking Moments...")
		percent := 0
		for i, m := range moments {
			checkMoments(m, shelf)
			percentNext := int(100.0 * float64(i+1) / float64(len(moments)))
			if percentNext > percent {
				percent = percentNext
				log.Infof("%d/%d(%d%%) ...", i+1, len(moments), percent)
			}
		}
		log.Info(color.GreenString("[OK]"))
	}
}

func checkEntity(ent shelfPkg.Entity) {
	f, err := os.Open(ent.SystemPath())
	if err != nil {
		log.Fatalf("Sanity check failed: %v\npath: %s", err, ent.SystemPath())
	}
	defer f.Close()
	hasher := md5.New()
	_, err = io.Copy(hasher, f)
	if err != nil {
		log.Fatalf("Sanity check failed: %v\npath: %s", err, ent.SystemPath())
	}
	hash := hex.EncodeToString(hasher.Sum(nil)[:])
	if ent.ID() != hash {
		log.Fatalf(`Sanity check failed: hash mismatched!
path: %s
expected: %s
actual: %s`, err, ent.SystemPath(), hash, ent.ID())
	}
}

func checkMoments(m *shelfPkg.Moment, shelf *shelfPkg.Shelf) {
	p := fml.NewParser()
	rens, err := p.Parse(m.Text)
	if err != nil {
		log.Fatal(err)
	}
	for _, ren := range rens.Rens {
		var id string
		var entity shelfPkg.Entity
		switch v := ren.(type) {
		case *fml.Image:
			id = v.EntityID
			entity = shelf.LookupEntity(id)
			if entity == nil {
				log.Fatalf("[%s] [image id=%s] is not found", m.Path(), id)
			}
			if _, ok := entity.(*shelfPkg.ImageEntity); !ok {
				log.Fatalf("[%s] id=%s(%s) is not an Image: %v", m.Path(), id, entity.Path(), reflect.TypeOf(entity))
			}
		case *fml.Audio:
			id = v.EntityID
			entity = shelf.LookupEntity(id)
			if entity == nil {
				log.Fatalf("[%s] [audio id=%s] is not found", m.Path(), id)
			}
			if _, ok := entity.(*shelfPkg.AudioEntity); !ok {
				log.Fatalf("[%s] id=%s(%s) is not an Audio: %v", m.Path(), id, entity.Path(), reflect.TypeOf(entity))
			}
		case *fml.Video:
			id = v.EntityID
			entity = shelf.LookupEntity(id)
			if entity == nil {
				log.Fatalf("[%s] [video id=%s] is not found", m.Path(), id)
			}
			if _, ok := entity.(*shelfPkg.VideoEntity); !ok {
				log.Fatalf("[%s] id=%s(%s) is not an Video: %v", m.Path(), id, entity.Path(), reflect.TypeOf(entity))
			}
		}
	}
}
