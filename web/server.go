package web

import (
	"fmt"
	"html/template"
	"net/http"
	"time"

	"github.com/fairy-rockets/the-gear-of-seasons/web/omote"
	"github.com/fairy-rockets/the-gear-of-seasons/web/ura"

	"path/filepath"

	"sync"

	"github.com/Sirupsen/logrus"
	"github.com/fairy-rockets/the-gear-of-seasons/shelf"
	"github.com/fairy-rockets/the-gear-of-seasons/web/cache"
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

	srv := &Server{
		omoteServer: omote.NewServer(listenOmote, entityCache, momentCache),
		uraServer:   ura.NewServer(listenOmote, entityCache, momentCache),
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
	log().Infof("Start Omote Server at %s", srv.omoteImpl.Addr)
	var wg sync.WaitGroup
	wg.Add(2)
	runServer := func(server *http.Server, errP *error) {
		defer wg.Done()
		err := server.ListenAndServe()
		if err == http.ErrServerClosed {
			err = nil
		}
		*errP = err
	}
	var err1, err2 error
	go runServer(srv.omoteImpl, &err1)
	go runServer(srv.uraImpl, &err2)
	if err1 == nil && err2 == nil {
		return nil
	}
	return fmt.Errorf(`error on runnning servers: 
omote: %v
  ura: %v`, err1, err2)
}

func (srv *Server) Stop() error {
	ctx, _ := context.WithTimeout(context.Background(), time.Second*5)
	err1 := srv.omoteImpl.Shutdown(ctx)
	err2 := srv.uraImpl.Shutdown(ctx)
	if err1 == nil && err2 == nil {
		return nil
	}
	return fmt.Errorf(`error on shutting down all servers: 
omote: %v
  ura: %v`, err1, err2)
}

func (srv *Server) setError(w http.ResponseWriter, r *http.Request, err error) {
	w.WriteHeader(503)
	http.Error(w, fmt.Sprintf("[Error] %v", err), http.StatusInternalServerError)
}

func (srv *Server) parseTemplate(base string, files ...string) (*template.Template, error) {
	t := template.New(filepath.Base(base))
	base = fmt.Sprintf("%s/%s", TemplatesPath, base)
	for i := range files {
		files[i] = fmt.Sprintf("%s/%s", TemplatesPath, files[i])
	}
	allFiles := append([]string{base}, files...)
	return t.ParseFiles(allFiles...)
}

func (srv *Server) parseTemplateWithFuncs(funcs template.FuncMap, base string, files ...string) (*template.Template, error) {
	t := template.New(filepath.Base(base))
	t.Funcs(funcs)
	base = fmt.Sprintf("%s/%s", TemplatesPath, base)
	for i := range files {
		files[i] = fmt.Sprintf("%s/%s", TemplatesPath, files[i])
	}
	allFiles := append([]string{base}, files...)
	return t.ParseFiles(allFiles...)
}
