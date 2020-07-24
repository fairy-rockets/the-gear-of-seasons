package fml

import "io"

type state struct {
	runes []rune
	index int
}

// ----------------------------------------------------------------------------
// State
// ----------------------------------------------------------------------------

func (s *state) consume(length int) *state {
	return &state{
		runes: s.runes,
		index: s.index + length,
	}
}

func (s *state) copy() *state {
	ns := *s
	return &ns
}

func (s *state) at(idx int) rune {
	return s.runes[s.index+idx]
}

func (s *state) consumeString(length int) (*state, string, error) {
	if s.index+length > len(s.runes) {
		return nil, "", io.EOF
	}
	return s.consume(length), string(s.runes[s.index : s.index+length]), nil
}

func (s *state) isEmpty() bool {
	return s.index >= len(s.runes)
}
