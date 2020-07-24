package ura

import (
	"context"
	"fmt"
	"net/http"

	"github.com/fairy-rockets/the-gear-of-seasons/web/util"

	"github.com/sirupsen/logrus"

	"github.com/fairy-rockets/the-gear-of-seasons/internal/shelf"
	"github.com/fairy-rockets/the-gear-of-seasons/web/cache"
	"github.com/julienschmidt/httprouter"
)

func log() *logrus.Entry {
	return logrus.WithField("Module", "UraSrv")
}

type Server struct {
	// 特有
	impl   *http.Server
	router *httprouter.Router
	// 共用
	staticPath  string
	templateGen *util.TemplateBuilderGenerator
	shelf       *shelf.Shelf
	entityCache *cache.EntityCache
	momentCache *cache.MomentCache
}

func NewServer(listen string, staticPath string, templateGen *util.TemplateBuilderGenerator, shelf *shelf.Shelf, entityCache *cache.EntityCache, momentCache *cache.MomentCache) *Server {
	srv := &Server{
		router:      httprouter.New(),
		staticPath:  staticPath,
		templateGen: templateGen,
		shelf:       shelf,
		entityCache: entityCache,
		momentCache: momentCache,
	}
	srv.impl = &http.Server{
		Addr:    listen,
		Handler: srv.router,
	}
	srv.setupRoute()
	return srv
}

func (srv *Server) setupRoute() {
	r := srv.router
	r.NotFound = srv

	// index
	r.GET("/", srv.serveIndex)

	// 編集
	r.GET("/new", srv.serveNew)
	r.POST("/preview", srv.servePreview)
	r.POST("/save", srv.serveSave)
	r.POST("/upload", srv.serveUpload)

	// moments
	r.GET("/moments/", srv.serveMoments)
	r.GET("/moments/:year", srv.serveMomentsLists)

	// entities
	r.GET("/entities/", srv.serveEntities)
	r.GET("/entities/:year", srv.serveEntitiesLists)

	// static
	r.ServeFiles("/static/*filepath", http.Dir(srv.staticPath))

	// entity (redirect)
	r.GET("/entity/:id", srv.serveEntity)
	r.GET("/entity/:id/icon", srv.serveEntityIcon)
	r.GET("/entity/:id/medium", srv.serveEntityMedium)

}

func (srv *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		m := srv.shelf.LookupMoment(r.URL.Path)
		if m != nil {
			srv.serveEdit(w, r, nil)
			return
		}
	}
	w.WriteHeader(404)
	_, _ = fmt.Fprintf(w, "404: Page not found.")
}

func (srv *Server) Start() error {
	log().Infof("Start Ura Server at %s", srv.impl.Addr)
	return srv.impl.ListenAndServe()
}

func (srv *Server) Shutdown(ctx context.Context) error {
	return srv.impl.Shutdown(ctx)
}
