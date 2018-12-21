package fml

import (
	"testing"
)

func TestExampleSuccess(t *testing.T) {
	p := NewParser()
	uta, err := p.Parse(`
あいうえお

あいうえお
[image k="v" k2="v2"]
`)
	if err != nil {
		t.Fatal("Could not parse: ", err)
	}
	for _, v := range uta.Rens {
		t.Error(v.ToString())
	}
}

func TestExampleFailed(t *testing.T) {
}
