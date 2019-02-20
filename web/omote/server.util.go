package omote

import (
	"fmt"
	"html/template"
	"net/http"
	"path/filepath"
)

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
