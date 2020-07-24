package util

import (
	"html/template"
	"path/filepath"
)

type TemplateBuilderGenerator struct {
	templatePath string
}

type TemplateBuilder struct {
	templatePath string
	base         string
	files        []string
	funcs        map[string]interface{}
}

func NewTemplateBuilderGenerator(path string) *TemplateBuilderGenerator {
	return &TemplateBuilderGenerator{
		templatePath: path,
	}
}

func (g *TemplateBuilderGenerator) Parse(base string) *TemplateBuilder {
	return &TemplateBuilder{
		templatePath: g.templatePath,
		base:         base,
		funcs:        make(map[string]interface{}),
	}
}

func (b *TemplateBuilder) Parse(files ...string) *TemplateBuilder {
	b.files = append(b.files, files...)
	return b
}

func (b *TemplateBuilder) AddFunc(name string, fn interface{}) *TemplateBuilder {
	b.funcs[name] = fn
	return b
}

func (b *TemplateBuilder) Bulld() (*template.Template, error) {
	t := template.New(filepath.Base(b.base))
	t.Funcs(b.funcs)
	files := make([]string, 0)
	files = append(files, filepath.Join(b.templatePath, b.base))
	for i := range b.files {
		files = append(files, filepath.Join(b.templatePath, b.files[i]))
	}
	return t.ParseFiles(files...)
}
