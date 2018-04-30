package web

import (
	"html/template"
	"net/http"
	"time"

	"fmt"

	"path/filepath"

	"github.com/FairyRockets/the-gear-of-seasons/entity"
	"github.com/FairyRockets/the-gear-of-seasons/moment"
	"github.com/Sirupsen/logrus"
	"github.com/julienschmidt/httprouter"
	"golang.org/x/net/context"
)

const (
	StaticPath    = "_resources/static"
	TemplatesPath = "_resources/templates"
)

type Web struct {
	impl        *http.Server
	router      *httprouter.Router
	entities    *entity.Store
	moments     *moment.Store
	momentCache *momentCache
	entityCache *entityCache
}

func log() *logrus.Entry {
	return logrus.WithField("Module", "Web")
}

func NewWebServer(addr string, entities *entity.Store, moments *moment.Store) *Web {
	srv := &Web{
		router:      httprouter.New(),
		entities:    entities,
		moments:     moments,
		momentCache: newMomentCache(entities, moments),
		entityCache: newEntityCache(entities, filepath.Join(entities.Path(), "_cache")),
	}
	srv.impl = &http.Server{
		Addr:    addr,
		Handler: srv,
	}
	srv.setupRoute()
	return srv
}

func (srv *Web) setupRoute() {
	router := srv.router
	router.GET("/", srv.serveIndex)
	router.GET("/entity/:id", srv.serveEntity)
	router.GET("/entity/:id/thumbnail", srv.serveEntityThumbnail)
	router.GET("/moment/search", srv.serveMomentSearch)
	router.ServeFiles("/static/*filepath", http.Dir(StaticPath))
}

func (srv *Web) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	if req.Method == "GET" {
		m := srv.moments.Lookup(req.URL.Path)
		if m != nil {
			srv.serveMoment(w, req, m)
			return
		}
	}
	srv.router.ServeHTTP(w, req)
}

func (srv *Web) Prepare() {
	ents := srv.entities.AsSlice()
	for i, ent := range ents {
		if _, ok := ent.(*entity.ImageEntity); ok {
			_, err := srv.entityCache.FetchThumbnail(ent)
			if err != nil {
				log().Fatalf("Prepare Thumbnails for %s: %v", ent.GetID(), err)
			} else {
				log().Infof("Prepare Thumbnails [%d / %d]", i+1, len(ents))
			}
		}
	}
}
func (srv *Web) Start() error {
	log().Infof("Start at %s", srv.impl.Addr)
	err := srv.impl.ListenAndServe()
	if err == http.ErrServerClosed {
		err = nil
	}
	return err
}

func (srv *Web) Stop() error {
	ctx, _ := context.WithTimeout(context.Background(), time.Second*5)
	return srv.impl.Shutdown(ctx)
}

func (srv *Web) setError(w http.ResponseWriter, r *http.Request, err error) {
	w.WriteHeader(501)
	fmt.Fprintf(w, "Error:\n%v", err)
}

func (srv *Web) templateOf(files ...string) (*template.Template, error) {
	for i := range files {
		files[i] = fmt.Sprintf("%s/%s", TemplatesPath, files[i])
	}
	return template.ParseFiles(files...)
}
