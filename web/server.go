package web

import (
	"fmt"
	"time"

	"github.com/fairy-rockets/the-gear-of-seasons/web/omote"
	"github.com/fairy-rockets/the-gear-of-seasons/web/ura"
	"github.com/fairy-rockets/the-gear-of-seasons/web/util"

	"path/filepath"

	"sync"

	"github.com/fairy-rockets/the-gear-of-seasons/internal/shelf"
	"github.com/fairy-rockets/the-gear-of-seasons/web/cache"
	"github.com/sirupsen/logrus"
	"golang.org/x/net/context"
)

const (
	StaticPath    = "_resources/static"
	TemplatesPath = "_resources/templates"
)

type Server struct {
	omoteServer *omote.Server
	uraServer   *ura.Server
	shelf       *shelf.Shelf
	entityCache *cache.EntityCache
	momentCache *cache.MomentCache
}

func log() *logrus.Entry {
	return logrus.WithField("Module", "Server")
}

func NewServer(listenOmote, listenUra string, shelf *shelf.Shelf, cachePath string) *Server {
	entityCache := cache.NewEntityCache(shelf, filepath.Join(cachePath, "entity"))
	momentCache := cache.NewMomentCache(shelf)
	templateGen := util.NewTemplateBuilderGenerator(TemplatesPath)

	srv := &Server{
		omoteServer: omote.NewServer(listenOmote, StaticPath, templateGen, shelf, entityCache, momentCache),
		uraServer:   ura.NewServer(listenUra, StaticPath, templateGen, shelf, entityCache, momentCache),
		shelf:       shelf,
		entityCache: entityCache,
		momentCache: momentCache,
	}

	return srv
}

func (srv *Server) Prepare() error {
	var err error
	ents := srv.shelf.FindAllEntities()
	for i, ent := range ents {
		switch e := ent.(type) {
		case *shelf.ImageEntity:
			if _, err = srv.entityCache.FetchIcon(e); err != nil {
				return err
			}
			if _, err = srv.entityCache.FetchMediumThumbnail(e); err != nil {
				return err
			}
		default:
			/* Nothing to do */
		}
		log().Infof("Entity[%d/%d] prepared.", i+1, len(ents))
	}
	return nil
}

func (srv *Server) Start() error {
	var wg sync.WaitGroup
	wg.Add(2)
	var err1, err2 error
	go func() {
		defer wg.Done()
		err1 = srv.omoteServer.Start()
	}()
	go func() {
		defer wg.Done()
		err2 = srv.uraServer.Start()
	}()
	if err1 == nil && err2 == nil {
		return nil
	}
	return fmt.Errorf(`error on runnning servers: 
omote: %v
  ura: %v`, err1, err2)
}

func (srv *Server) Stop() error {
	ctx, _ := context.WithTimeout(context.Background(), time.Second*5)
	err1 := srv.omoteServer.Shutdown(ctx)
	err2 := srv.uraServer.Shutdown(ctx)
	if err1 == nil && err2 == nil {
		return nil
	}
	return fmt.Errorf(`error on shutting down all servers: 
omote: %v
  ura: %v`, err1, err2)
}
