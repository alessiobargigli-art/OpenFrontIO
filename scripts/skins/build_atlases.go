// Run from the repository root: go run scripts/skins/build_atlases.go
// Only the Go standard library is required; Docker consumes committed atlases.
package main

import (
	"fmt"
	"image"
	"image/draw"
	"image/png"
	"os"
	"path/filepath"
)

func read(path string) image.Image {
	f, err := os.Open(path)
	if err != nil {
		panic(err)
	}
	defer f.Close()
	img, err := png.Decode(f)
	if err != nil {
		panic(err)
	}
	return img
}
func save(path string, img image.Image) {
	f, err := os.Create(path)
	if err != nil {
		panic(err)
	}
	if err = png.Encode(f, img); err != nil {
		panic(err)
	}
	if err = f.Close(); err != nil {
		panic(err)
	}
}
func build(base, output string, names []string, sizes []int) {
	const cell = 128
	original := read(base)
	if original.Bounds().Dx() != len(names)*cell || original.Bounds().Dy() != cell {
		panic("unexpected original atlas dimensions")
	}
	atlas := image.NewNRGBA(image.Rect(0, 0, len(names)*cell, cell*2))
	draw.Draw(atlas, original.Bounds(), original, original.Bounds().Min, draw.Src)
	for i, name := range names {
		src := read(filepath.Join("resources/skins/warcraft", name+".png"))
		if src.Bounds().Dx() != cell || src.Bounds().Dy() != cell {
			panic("unexpected sprite dimensions: " + name)
		}
		size := cell
		if sizes != nil {
			size = cell * sizes[i] / 13
		}
		x0, y0 := i*cell+(cell-size)/2, cell+(cell-size)/2
		for y := 0; y < size; y++ {
			for x := 0; x < size; x++ {
				atlas.Set(x0+x, y0+y, src.At(x*cell/size, y*cell/size))
			}
		}
	}
	save(output, atlas)
	fmt.Println(output)
}
func main() {
	build("resources/atlases/unit-atlas.png", "resources/atlases/unit-skins.png", []string{"transportship", "tradeship", "warship", "atombomb", "hydrogenbomb", "mirv2", "samMissile", "shell", "mirvWarhead", "trainEngine", "trainCarriage", "trainCarriageLoaded"}, []int{5, 5, 11, 7, 9, 13, 3, 1, 3, 5, 5, 5})
	build("resources/atlases/icon-atlas.png", "resources/atlases/icon-skins.png", []string{"city", "port", "factory", "defensePost", "samLauncher", "missileSilo"}, nil)
}
