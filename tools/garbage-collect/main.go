package main

import (
	"flag"
	_ "image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"reflect"

	"github.com/fairy-rockets/the-gear-of-seasons/fml"

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

	log.Info(color.GreenString("[OK]"))

	entities := shelf.FindAllEntities()
	moments := shelf.FindAllMoments()

	usedEntities := make(map[string]shelfPkg.Entity)

	{
		log.Info("----------------------------------------")
		log.Info("Checking Moments...")
		percent := 0
		for i, m := range moments {
			checkMoments(m, shelf, usedEntities)
			percentNext := int(100.0 * float64(i+1) / float64(len(moments)))
			if percentNext > percent {
				percent = percentNext
				log.Infof("%d/%d(%d%%) ...", i+1, len(moments), percent)
			}
		}
		log.Info(color.GreenString("[OK]"))
		log.Info("----------------------------------------")
	}

	for _, entity := range entities {
		e1, ok := usedEntities[entity.ID()]
		if ok && e1 != entity {
			log.Fatalf("id=%s duplicated: %s vs %s", entity.ID(), e1.Path(), entity.Path())
		}
		if !ok {
			err = shelf.RemoveEntity(entity)
			if err == nil {
				log.Infof("Unused entity %s(%s) removed", entity.ID(), entity.Path())
			} else {
				log.Fatalf("Failed to remove unused entity %s(%s): %v", entity.ID(), entity.Path(), err)
			}
		}
	}
	log.Info(color.GreenString("[OK]"))
}

func checkMoments(m *shelfPkg.Moment, shelf *shelfPkg.Shelf, usedEntities map[string]shelfPkg.Entity) {
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
			if _, ok := entity.(*shelfPkg.ImageEntity); !ok {
				log.Fatalf("[%s] id=%s(%s) is not an Image: %v", m.Path(), id, entity.Path(), reflect.TypeOf(entity))
			}
		case *fml.Audio:
			id = v.EntityID
			entity = shelf.LookupEntity(id)
			if _, ok := entity.(*shelfPkg.AudioEntity); !ok {
				log.Fatalf("[%s] id=%s(%s) is not an Audio: %v", m.Path(), id, entity.Path(), reflect.TypeOf(entity))
			}
		case *fml.Video:
			id = v.EntityID
			entity = shelf.LookupEntity(id)
			if _, ok := entity.(*shelfPkg.VideoEntity); !ok {
				log.Fatalf("[%s] id=%s(%s) is not an Video: %v", m.Path(), id, entity.Path(), reflect.TypeOf(entity))
			}
		default:
			continue
		}
		usedEntities[id] = entity
	}
}
