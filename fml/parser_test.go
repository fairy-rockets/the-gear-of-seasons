package fml

import (
	"testing"
)

func TestExampleSuccess(t *testing.T) {
	p := NewParser()
	uta, err := p.Parse(`
あいうえお



あいうえお
[image entity="id" link="https://hexe.net/"]
`)
	if err != nil {
		t.Fatal(`Could not parse: `, err)
	}
	if len(uta.Rens) != 3 {
		t.Fatal(`連は３つあるはず`)
	}
	var text Text
	var im *Image
	var ok bool
	if text, ok = uta.Rens[0].(Text); !ok {
		t.Errorf(`最初の連はテキストなはず`)
	}
	if text.ToString() != `あいうえお` {
		t.Errorf(`expected: あいうえお, got %s`, text.ToString())
	}
	if text, ok = uta.Rens[1].(Text); !ok {
		t.Errorf(`まんなか連もテキストなはず`)
	}
	if text.ToString() != `あいうえお` {
		t.Errorf(`expected: あいうえお, got %s`, text.ToString())
	}
	if im, ok = uta.Rens[2].(*Image); !ok {
		t.Errorf(`最後の連は画像なはず`)
	}
	if im.EntityID != `id` {
		t.Errorf(`expected: id, got %s`, im.EntityID)
	}
	if im.LinkURL != `https://hexe.net/` {
		t.Errorf(`expected: "https://hexe.net/", got %s`, im.LinkURL)
	}
}

func TestExampleFailed(t *testing.T) {
	var err error
	p := NewParser()
	_, err = p.Parse(`
[image entity="id" 
`)
	if err == nil {
		t.Fatal(`Should fail: `, err)
	}
	uta, err := p.Parse(`
[image entity="id"
あいうえお
[image entity="id" link="https://hexe.net/"]
`)
	if err == nil {
		t.Fatal(`Should fail, got: `, uta.ToString())
	}
}
