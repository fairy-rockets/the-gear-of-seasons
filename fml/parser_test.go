package fml

import (
	"testing"
)

func TestExampleSuccess(t *testing.T) {
	p := NewParser()
	uta, err := p.Parse(`
[image k="v"]
あいうえお
`)
	if err != nil {
		t.Fatal("Could not parse: ", err)
	}
	t.Error(uta.Rens[0].ToString())
}

func TestExampleFailed(t *testing.T) {
}
