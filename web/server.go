package web

import (
	"fmt"
	"html/template"
	"net/http"
	"time"

	"github.com/FairyRockets/the-gear-of-seasons/seasonshelf"
	"github.com/FairyRockets/the-gear-of-seasons/seasonshelf/entity"
	"github.com/FairyRockets/the-gear-of-seasons/web/cache"
	"github.com/Sirupsen/logrus"
	"github.com/julienschmidt/httprouter"
	"golang.org/x/net/context"
)

const (
	StaticPath    = "_resources/static"
	TemplatesPath = "_resources/templates"
)

type Server struct {
	impl        *http.Server
	router      *httprouter.Router
	shelf       *seasonshelf.Shelf
	entityCache *cache.EntityCache
	momentCache *cache.MomentCache
}

func log() *logrus.Entry {
	return logrus.WithField("Module", "Web")
}

func NewServer(addr string, shelf *seasonshelf.Shelf) *Server {
	srv := &Server{
		router:      httprouter.New(),
		shelf:       shelf,
		entityCache: cache.NewEntityCache(shelf, "_cache/entity"),
		momentCache: cache.NewMomentCache(shelf),
	}
	srv.impl = &http.Server{
		Addr:    addr,
		Handler: srv,
	}
	srv.setupRoute()
	return srv
}

func (srv *Server) setupRoute() {
	router := srv.router
	router.GET("/", srv.serveIndex)
	router.GET("/entity/:id", srv.serveEntity)
	router.GET("/entity/:id/icon", srv.serveEntityIcon)
	router.GET("/entity/:id/medium", srv.serveEntityMedium)
	router.GET("/moment/*moment", srv.serveMoment)
	router.ServeFiles("/static/*filepath", http.Dir(StaticPath))
}

func (srv *Server) Prepare() error {
	var err error
	ents := srv.shelf.FindAllEntities()
	for i, ent := range ents {
		switch e := ent.(type) {
		case *entity.ImageEntity:
			if _, err = srv.entityCache.FetchIcon(e); err != nil {
				return err
			}
			if _, err = srv.entityCache.FetchMedium(e); err != nil {
				return err
			}
		default:
			/* Nothing to do */
		}
		log().Infof("Entity[%d/%d] prepared.", i, len(ents))
	}
	return nil
}

func (srv *Server) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	if req.Method == "GET" {
		m := srv.shelf.LookupMoment(req.URL.Path)
		if m != nil {
			srv.serveIndex(w, req, nil)
			return
		}
	}
	srv.router.ServeHTTP(w, req)
}

func (srv *Server) Start() error {
	log().Infof("Start at %s", srv.impl.Addr)
	err := srv.impl.ListenAndServe()
	if err == http.ErrServerClosed {
		err = nil
	}
	return err
}

func (srv *Server) Stop() error {
	ctx, _ := context.WithTimeout(context.Background(), time.Second*5)
	return srv.impl.Shutdown(ctx)
}

func (srv *Server) setError(w http.ResponseWriter, r *http.Request, err error) {
	w.WriteHeader(501)
	fmt.Fprintf(w, "Error:\n%v", err)
}

func (srv *Server) templateOf(files ...string) (*template.Template, error) {
	for i := range files {
		files[i] = fmt.Sprintf("%s/%s", TemplatesPath, files[i])
	}
	return template.ParseFiles(files...)
}
