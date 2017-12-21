import React, {Component} from 'react';
import {connect} from 'react-redux';
import Tile from './tile';
import Grid from './grid';
import Tiler from './tiler';
import storageManager from './storage-manager';

class TileContainer extends Component {
    constructor(props) {
        super(props);
        const inputManager = props.inputManager;
        this.state = this.setup();
        this.startRandomTiles(this.state);
        inputManager.on('move', this.move);
        inputManager.on('restart', this.restart);
        inputManager.on('keepPlaying', this.keepPlaying);
        inputManager.listen();
    }
    setup = () => {
        const prevState = storageManager.getGameState();
        const size = prevState
            ? prevState.grid.size
            : 4;
        const grid = prevState
            ? new Grid(size, prevState.grid.cells)
            : new Grid(size);
        return {size, grid, startTiles: 2, Tiles: null}
    }
    startRandomTiles = ({startTiles, grid}) => {
        for (let i = 0; i < startTiles; i++) {
            grid.addRandomTile();
        }
    }
    prepareTiles = () => {
        this
            .state
            .grid
            .eachCell((x, y, tile) => {
                if (tile) {
                    tile.mergedFrom = null;
                    tile.savePosition();
                }
            });
    }
    getVector = (direction) => {
        // 0: up, 1: right, 2: down, 3: left
        const map = {
            0: {
                x: 0,
                y: -1
            },
            1: {
                x: 1,
                y: 0
            },
            2: {
                x: 0,
                y: 1
            },
            3: {
                x: -1,
                y: 0
            }
        }
        return map[direction];
    }
    buildTraversals = ({x, y}) => {
        const traversals = {
            x: [],
            y: []
        };
        for (let i = 0; i < this.state.size; i++) {
            traversals
                .x
                .push(i);
            traversals
                .y
                .push(i);
        }
        if (x === 1) 
            traversals.x = traversals.x.reverse();
        if (y === 1) 
            traversals.y = traversals.y.reverse();
        return traversals;
    }
    findFarthestPosition = (cell, vector) => {
        const {grid} = this.state;
        let prev;
        do {
            prev = cell;
            cell = {
                x: prev.x + vector.x,
                y: prev.y + vector.y
            }
        } while (grid.withinBounds(cell) && !grid.cellContent(cell));
        return {farthest: prev, next: cell}
    }
    positionsEqual = (first, second) => {
        return first.x === second.x && first.y === second.y;
    }
    tileMatchesAvailable = () => {
        const {grid, size} = this.state;
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                const tile = grid.cellContent({x, y});
                if (tile) {
                    for (let direction = 0; direction < 4; direction++) {
                        const vector = this.getVector(direction);
                        const cell = {
                            x: x + vector.x,
                            y: y + vector.y
                        }
                        const other = grid.cellContent(cell);
                        if (other && other.value === tile.value) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }
    movesAvailable = () => {
        return !!this
            .state
            .grid
            .availableCells()
            .lengths || this.tileMatchesAvailable();
    }
    mergeTiles = (tileOne, tileTwo) => {
        const {grid} = this.state;
        const merged = new Tiler({
            x: tileTwo.x,
            y: tileTwo.y
        }, tileOne.value * 2);
        merged.mergedFrom = [tileOne, tileTwo];
        if (this.tiles[`${tileOne.x}-${tileOne.y}`]) {
            this
                .tiles[`${tileOne.x}-${tileOne.y}`]
                .classList
                .remove(`tile-position-${tileOne.x + 1}-${tileOne.y + 1}`);
            this
                .tiles[`${tileOne.x}-${tileOne.y}`]
                .classList
                .add(`tile-position-${merged.x + 1}-${merged.y + 1}`);
        }
        grid.insertTile(merged);
        grid.removeTile(tileOne);
        tileOne.updatePosition({x: tileTwo.x, y: tileTwo.y});
    }
    moveTile = (tile, cell) => {
        const {grid} = this.state;
        if (this.tiles[`${tile.x}-${tile.y}`]) {
            this
                .tiles[`${tile.x}-${tile.y}`]
                .classList
                .remove(`tile-position-${tile.x + 1}-${tile.y + 1}`);
            this
                .tiles[`${tile.x}-${tile.y}`]
                .classList
                .add(`tile-position-${cell.x + 1}-${cell.y + 1}`);
        }
        grid.cells[tile.x][tile.y] = null;
        grid.cells[cell.x][cell.y] = tile;
        tile.updatePosition(cell);
    }
    move = (direction) => {
        setTimeout(() => {
            const {grid} = this.state;
            const vector = this.getVector(direction);
            const traversals = this.buildTraversals(vector);
            let moved = false;
            this.prepareTiles();
            traversals
                .x
                .forEach(x => {
                    traversals
                        .y
                        .forEach(y => {
                            let cell = {
                                x,
                                y
                            };
                            const tile = grid.cellContent(cell);
                            if (tile) {
                                const positions = this.findFarthestPosition(cell, vector);
                                const next = grid.cellContent(positions.next);
                                if (next && next.value === tile.value && !next.mergedFrom) 
                                    this.mergeTiles(tile, next);
                                else 
                                    this.moveTile(tile, positions.farthest);
                                if (!this.positionsEqual(cell, tile)) 
                                    moved = true;
                                }
                            })
                })
            if (moved) 
                setTimeout(() => {
                    grid.addRandomTile();
                    this.renderHandle();
                }, 100);
            }
        , 100);
    }
    restart = () => {
        storageManager.clearGameState();
        this.setState(this.setup());
        setTimeout(() => {
            this.startRandomTiles(this.state);
            this.renderHandle();
        }, 1);
    }
    keepPlaying = () => {}
    renderHandle = () => {
        this.setState((prevState, props) => {
            this.tiles = {};
            const Tiles = [];
            prevState
                .grid
                .eachCell((x, y, tile) => {
                    if (tile) 
                        Tiles.push(
                            <Tile
                                inner={tile.value}
                                x={tile.x}
                                y={tile.y}
                                new={!tile.prevPosition && !tile.mergedFrom}
                                merged={!!tile.mergedFrom}
                                tileRef={t => {
                                this.tiles[`${x}-${y}`] = t;
                            }}
                                key={Math.floor(Math.random() * 100000000000000).toString(16)}></Tile>
                        )
                });
            return {Tiles};
        })
    }
    componentWillMount() {
        this.renderHandle();
    }
    render() {
        return (
            <div className="tile-container">
                {this.state.Tiles}
            </div>
        )
    }
}

export default connect(({inputManager}) => {
    return {inputManager};
})(TileContainer);