package main

import (
	"crypto/md5"
	"encoding/hex"
	"flag"
	"fmt"
	_ "image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"os"
	"reflect"

	shelfPkg "github.com/fairy-rockets/the-gear-of-seasons/internal/shelf"
	"github.com/fairy-rockets/the-gear-of-seasons/pkg/fml"
	"github.com/mattn/go-isatty"
	"go.uber.org/zap"
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

	entities := shelf.FindAllEntities()
	moments := shelf.FindAllMoments()
	{
		log.Info("----------------------------------------")
		log.Info("Checking Entities...")
		log.Info("----------------------------------------")
		percent := 0
		for i, ent := range entities {
			checkEntity(ent)
			percentNext := int(100.0 * float64(i+1) / float64(len(entities)))
			if percentNext > percent {
				percent = percentNext
				log.Info("Checking entities", zap.Int("current", i+1), zap.Int("total", len(entities)), zap.Int("percent", percent))
			}
		}
		log.Info("[OK]")
	}
	{
		log.Info("----------------------------------------")
		log.Info("Checking Moments...")
		log.Info("----------------------------------------")
		percent := 0
		for i, m := range moments {
			checkMoments(m, shelf)
			percentNext := int(100.0 * float64(i+1) / float64(len(moments)))
			if percentNext > percent {
				percent = percentNext
				log.Info("Checking moments", zap.Int("current", i+1), zap.Int("total", len(moments)), zap.Int("percent", percent))
			}
		}
		log.Info("[OK]")
	}
}

func checkEntity(ent shelfPkg.Entity) {
	log := zap.L()
	f, err := os.Open(ent.SystemPath())
	if err != nil {
		log.Fatal("Sanity check failed", zap.String("entity-path", ent.SystemPath()), zap.Error(err))
	}
	defer f.Close()
	hasher := md5.New()
	_, err = io.Copy(hasher, f)
	if err != nil {
		log.Fatal("Sanity check failed", zap.String("entity-path", ent.SystemPath()), zap.Error(err))
	}
	hash := hex.EncodeToString(hasher.Sum(nil)[:])
	if ent.ID() != hash {
		log.Fatal("Sanity check failed: hash mismatched!", zap.String("entity-path", ent.SystemPath()), zap.String("expected", ent.ID()), zap.String("actual", hash))
	}
}

func checkMoments(m *shelfPkg.Moment, shelf *shelfPkg.Shelf) {
	log := zap.L()
	p := fml.NewParser()
	rens, err := p.Parse(m.Text)
	if err != nil {
		log.Fatal("Failed to parse moment", zap.Error(err))
	}
	for _, ren := range rens.Rens {
		var id string
		var entity shelfPkg.Entity
		switch v := ren.(type) {
		case *fml.Image:
			id = v.EntityID
			entity = shelf.LookupEntity(id)
			if entity == nil {
				log.Fatal("Image not found", zap.String("moment-path", m.Path()), zap.String("id", id))
				return
			}
			if _, ok := entity.(*shelfPkg.ImageEntity); !ok {
				log.Fatal("Referred entity is not an image",
					zap.String("moment-path", m.Path()),
					zap.String("id", id),
					zap.String("entity-path", entity.SystemPath()),
					zap.String("actual-type", reflect.TypeOf(entity).String()))
			}
		case *fml.Audio:
			id = v.EntityID
			entity = shelf.LookupEntity(id)
			if entity == nil {
				log.Fatal("Audio not found", zap.String("moment-path", m.Path()), zap.String("id", id))
				return
			}
			if _, ok := entity.(*shelfPkg.AudioEntity); !ok {
				log.Fatal("Referred entity is not an audio",
					zap.String("moment-path", m.Path()),
					zap.String("id", id),
					zap.String("entity-path", entity.SystemPath()),
					zap.String("actual-type", reflect.TypeOf(entity).String()))
			}
		case *fml.Video:
			id = v.EntityID
			entity = shelf.LookupEntity(id)
			if entity == nil {
				log.Fatal("Video not found", zap.String("moment-path", m.Path()), zap.String("id", id))
				return
			}
			if _, ok := entity.(*shelfPkg.VideoEntity); !ok {
				log.Fatal("Referred entity is not an video",
					zap.String("moment-path", m.Path()),
					zap.String("id", id),
					zap.String("entity-path", entity.SystemPath()),
					zap.String("actual-type", reflect.TypeOf(entity).String()))
			}
		}
	}
}
