package main

import (
	"flag"
	"fmt"
	_ "image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"log"
	"os"
	"reflect"

	"github.com/fairy-rockets/the-gear-of-seasons/pkg/fml"
	"github.com/mattn/go-isatty"
	"go.uber.org/zap"

	shelfPkg "github.com/fairy-rockets/the-gear-of-seasons/internal/shelf"
)

//go:generate bash ../../scripts/generate-buildinfo.sh

// logging
var standardLog = flag.Bool("standard-log", false, "Show log human readably")

var shelfPath = flag.String("shelf", "_shelf", "shelf path")

var shelf *shelfPkg.Shelf

func printLogo() {
	log := zap.L()
	log.Info("****************************************")
	log.Info("  the-gear-of-seasons  ")
	log.Info("****************************************")
	log.Info("Build info", zap.String("revision", gitRev()), zap.String("build-at", buildAt()))
}

func main() {
	var err error
	var log *zap.Logger

	printLogo()
	flag.Parse()
	// Check is terminal
	if *standardLog || isatty.IsTerminal(os.Stdout.Fd()) || isatty.IsCygwinTerminal(os.Stdout.Fd()) {
		log, err = zap.NewDevelopment()
	} else {
		log, err = zap.NewProduction()
	}
	if err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "Failed to create logger: %v", err)
		os.Exit(-1)
	}
	undo := zap.ReplaceGlobals(log)
	defer undo()
	log.Info("----------------------------------------")
	log.Info("Initializing...")
	log.Info("----------------------------------------")
	log.Info("Log System Initialized.")
	storage, err := shelfPkg.NewStorage(*shelfPath)
	if err != nil {
		log.Fatal("Failed to prepare storage", zap.Error(err))
	}
	shelf = shelfPkg.New(storage)
	if err := shelf.Init(); err != nil {
		log.Fatal("Failed to prepare shelf", zap.Error(err))
	}
	log.Info("Database read", zap.Int("num-entities", shelf.NumEntities()), zap.Int("num-moments", shelf.NumMoments()))

	log.Info("[OK]")

	entities := shelf.FindAllEntities()
	moments := shelf.FindAllMoments()

	usedEntities := make(map[string]shelfPkg.Entity)

	{
		log.Info("----------------------------------------")
		log.Info("Checking Moments...")
		log.Info("----------------------------------------")
		percent := 0
		for i, m := range moments {
			checkMoments(m, shelf, usedEntities)
			percentNext := int(100.0 * float64(i+1) / float64(len(moments)))
			if percentNext > percent {
				percent = percentNext
				log.Info("Checking moments", zap.Int("current", i+1), zap.Int("total", len(moments)), zap.Int("percent", percent))
			}
		}
		log.Info("[OK]")
	}

	for _, entity := range entities {
		e1, ok := usedEntities[entity.ID()]
		if ok && e1 != entity {
			log.Fatal("Entity duplicated", zap.String("id", entity.ID()), zap.String("path1", e1.Path()), zap.String("path2", entity.Path()))
		}
		if !ok {
			err = shelf.RemoveEntity(entity)
			if err == nil {
				log.Info("Unused entity removed", zap.String("id", entity.ID()), zap.String("path", entity.Path()))
			} else {
				log.Error("Failed to remove unused entity", zap.String("id", entity.ID()), zap.String("path", entity.Path()), zap.Error(err))
			}
		}
	}
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
