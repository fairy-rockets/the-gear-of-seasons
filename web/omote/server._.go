package omote

import (
	"context"
	"fmt"
	"net/http"

	"github.com/fairy-rockets/the-gear-of-seasons/web/util"

	"github.com/Sirupsen/logrus"

	"github.com/fairy-rockets/the-gear-of-seasons/shelf"
	"github.com/fairy-rockets/the-gear-of-seasons/web/cache"
	"github.com/julienschmidt/httprouter"
)

func log() *logrus.Entry {
	return logrus.WithField("Module", "OmoteSrv")
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
	r.GET("/about-us/", srv.serveIndex)

	// entity
	r.GET("/entity/:id", srv.serveEntity)
	r.GET("/entity/:id/icon", srv.serveEntityIcon)
	r.GET("/entity/:id/medium", srv.serveEntityMedium)

	// moment
	r.GET("/moment/*moment", srv.serveMoment)

	// static
	r.ServeFiles("/static/*filepath", http.Dir(srv.staticPath))
}

func (srv *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		m := srv.shelf.LookupMoment(r.URL.Path)
		if m != nil {
			srv.serveIndex(w, r, nil)
			return
		}
	}
	w.WriteHeader(404)
	_, _ = fmt.Fprintf(w, "404: Page not found.")
}

func (srv *Server) Start() error {
	log().Infof("Start Omote Server at %s", srv.impl.Addr)
	return srv.impl.ListenAndServe()
}

func (srv *Server) Shutdown(ctx context.Context) error {
	return srv.impl.Shutdown(ctx)
}
