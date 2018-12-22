package fml

import (
	"io"
	"reflect"
	"runtime"
	"strings"
)

type parser func(*state) (*state, interface{}, error)

// ----------------------------------------------------------------------------
// pred
// ----------------------------------------------------------------------------

func isSpace(r rune) bool {
	return r == ' ' || r == '\t' || r == '\r' || r == '\n'
}

// ----------------------------------------------------------------------------
// Skips
// ----------------------------------------------------------------------------

var skip0 parser = func(s *state) (*state, interface{}, error) {
	cnt := 0
	for s.index+cnt < len(s.runes) {
		if !isSpace(s.at(cnt)) {
			break
		}
		cnt++
	}
	return s.consume(cnt), cnt, nil
}

var skip1 parser = func(s *state) (*state, interface{}, error) {
	if s.isEmpty() || !isSpace(s.at(0)) {
		return nil, nil, s.error("Space expected")
	}
	cnt := 1
	for s.index+cnt < len(s.runes) {
		if !isSpace(s.at(cnt)) {
			break
		}
		cnt++
	}
	return s.consume(cnt), cnt, nil
}

// ----------------------------------------------------------------------------
// Combinator
// ----------------------------------------------------------------------------

func funcName(f interface{}) string {
	return runtime.FuncForPC(reflect.ValueOf(f).Pointer()).Name()
}

func manyRunes0(f func(rune) bool) parser {
	return func(s *state) (*state, interface{}, error) {
		cnt := 0
		for s.index < len(s.runes) {
			if !f(s.at(cnt)) {
				break
			}
			cnt++
		}
		return s.consumeString(cnt)
	}
}

func manyRunes1(f func(rune) bool) parser {
	return func(s *state) (*state, interface{}, error) {
		cnt := 0
		for s.index+cnt < len(s.runes) {
			if !f(s.at(cnt)) {
				break
			}
			cnt++
		}
		if cnt == 0 {
			return nil, nil, s.errorf("Expected %s, got %s", funcName(f), string([]rune{s.at(0)}))
		}
		return s.consumeString(cnt)
	}
}

func char(r rune) parser {
	return func(s *state) (*state, interface{}, error) {
		if s.isEmpty() {
			return nil, nil, io.EOF
		}
		if s.at(0) != r {
			return nil, nil, s.errorf("Expected %s, got %s", string([]rune{r}), string([]rune{s.at(0)}))
		}
		return s.consume(1), r, nil
	}
}

func str(expected string) parser {
	return func(s *state) (*state, interface{}, error) {
		var err error
		var actual string
		if s.isEmpty() {
			return nil, nil, io.EOF
		}
		s, actual, err = s.consumeString(len([]rune(expected)))
		if err != nil {
			return nil, nil, err
		}
		if actual != expected {
			return nil, nil, s.errorf("Expected %s, got %s", expected, actual)
		}
		return s, expected, nil
	}
}

func sep1(p parser, sep parser) parser {
	return func(s *state) (*state, interface{}, error) {
		if s.isEmpty() {
			return nil, nil, io.EOF
		}
		var res interface{}
		var err error
		results := make([]interface{}, 0)
		s, res, err = p(s)
		if err != nil {
			return nil, nil, err
		}
		results = append(results, res)
		for {
			var ns *state
			ns, _, err = sep(s)
			if err != nil {
				break
			}
			ns, res, err = p(ns)
			if err != nil {
				break
			}
			s = ns
			results = append(results, res)
		}
		return s, results, nil
	}
}

func choice(fs ...parser) parser {
	return func(s *state) (*state, interface{}, error) {
		if s.isEmpty() {
			return nil, nil, io.EOF
		}
		for _, f := range fs {
			ns, v, err := f(s)
			if err == nil {
				return ns, v, nil
			}
		}
		names := make([]string, 0)
		for _, f := range fs {
			names = append(names, funcName(f))
		}
		return nil, nil, s.errorf("Not matched: %s", strings.Join(names, ", "))
	}
}
