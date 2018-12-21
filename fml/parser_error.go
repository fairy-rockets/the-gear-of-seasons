package fml

import "fmt"

// ----------------------------------------------------------------------------
// Errors
// ----------------------------------------------------------------------------

type ParseError struct {
	Source   []rune
	Position int
	Message  string
}

func (err *ParseError) Error() string {
	return fmt.Sprintf("%s@%d", err.Message, err.Position)
}

func (s *state) errorf(format string, obj ...interface{}) *ParseError {
	return &ParseError{
		Source:   s.runes,
		Position: s.index,
		Message:  fmt.Sprintf(format, obj...),
	}
}

func (s *state) error(msg string) *ParseError {
	return &ParseError{
		Source:   s.runes,
		Position: s.index,
		Message:  msg,
	}
}
