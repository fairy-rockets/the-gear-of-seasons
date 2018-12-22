package fml

import (
	"io"
	"strings"
)

type Parser interface {
	Parse(text string) (*Uta, error)
}

// ----------------------------------------------------------------------------
// ParserImpl
// ----------------------------------------------------------------------------

type parserImpl struct {
}

func NewParser() Parser {
	return &parserImpl{}
}

func (p *parserImpl) Parse(text string) (*Uta, error) {
	var err error
	var u interface{}
	s := &state{
		runes: []rune(text),
		index: 0,
	}
	_, u, err = uta(s)
	if err != nil {
		return nil, err
	}
	return u.(*Uta), nil
}

// ----------------------------------------------------------------------------
// FML Parser
// ----------------------------------------------------------------------------

var uta parser = func(s *state) (*state, interface{}, error) {
	var u Uta
	var err error
	var obj interface{}
	for {
		s, _, _ = skip0(s)
		s, obj, err = choice(
			text,
			refer("image", NewImage),
			refer("video", NewVideo),
			refer("audio", NewAudio),
			refer("link", NewLink),
			refer("markdown", NewMarkdown))(s)
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, nil, err
		}
		u.Rens = append(u.Rens, obj.(Ren))
		s, _, _ = skip0(s)
	}
	return s, &u, nil
}

var text parser = func(s *state) (*state, interface{}, error) {
	if s.isEmpty() {
		return nil, nil, io.EOF
	}
	if s.at(0) == '[' {
		return nil, nil, s.error("'[' not allowed for text.")
	}
	var runes []rune
	for {
		if s.isEmpty() {
			return s, NewText(strings.TrimSpace(string(runes))), nil
		}
		r := s.at(0)
		if r == '[' {
			return s, NewText(strings.TrimSpace(string(runes))), nil
		}
		s = s.consume(1)
		if r == '\r' || r == '\n' {
			if s.isEmpty() {
				return s, NewText(strings.TrimSpace(string(runes))), nil
			}
			runes = append(runes, r)
			r = s.at(0)
			if r == '\r' || r == '\n' {
				return s.consume(1), NewText(strings.TrimSpace(string(runes))), nil
			}
		} else {
			runes = append(runes, r)
		}
	}
}

type kv struct {
	key   string
	value string
}

func refer(name string, conv func(map[string]string) Ren) parser {
	return func(s *state) (*state, interface{}, error) {
		var err error
		s, _, err = char('[')(s)
		if err != nil {
			return nil, nil, err
		}
		s, _, _ = skip0(s)
		s, _, err = str(name)(s)
		if err != nil {
			return nil, nil, err
		}
		s, _, err = skip1(s)
		if err != nil {
			return nil, nil, err
		}
		s, dictI, err := sep1(referAttr, skip1)(s)
		if err != nil {
			return nil, nil, err
		}
		s, _, _ = skip0(s)
		s, _, err = char(']')(s)
		if err != nil {
			return nil, nil, err
		}
		dict := make(map[string]string)
		for _, v := range dictI.([]interface{}) {
			ent := v.(kv)
			dict[ent.key] = ent.value
		}
		return s, conv(dict), nil
	}
}

var referAttrKey = manyRunes1(func(r rune) bool {
	return r != '=' && r != ']' && r != '"'
})

var referAttrValue = func(s *state) (*state, interface{}, error) {
	var err error
	var value interface{}
	s, _, err = char('"')(s)
	if err != nil {
		return nil, nil, err
	}
	s, value, err = manyRunes0(func(r rune) bool {
		return r != '"'
	})(s)
	s, _, err = char('"')(s)
	return s, value, nil
}

var referAttr parser = func(s *state) (*state, interface{}, error) {
	var err error
	var keyI, valueI interface{}
	s, keyI, err = referAttrKey(s)
	if err != nil {
		return nil, nil, err
	}
	s, _, err = char('=')(s)
	if err != nil {
		return nil, nil, err
	}
	s, valueI, err = referAttrValue(s)
	if err != nil {
		return nil, nil, err
	}
	return s, kv{
		key:   keyI.(string),
		value: valueI.(string),
	}, nil
}
