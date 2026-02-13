
#[cfg(test)]
mod tests {
    use super::super::grid::{GridState, MatchPattern}; // Assuming grid_test is in sim/ and grid is in sim/

    // Helper to create a specific grid for testing
    fn create_test_grid(width: usize, height: usize) -> GridState {
        let mut grid = GridState::new_empty(width, height);
        // No need to clear, it's already empty
        grid.auto_refill = false;
        grid
    }

    #[test]
    fn test_horizontal_match_line3() {
        let mut grid = create_test_grid(6, 6);
        // [0, 1, 2] -> Element 1 (Metal)
        grid.set_cell_element(0, 1);
        grid.set_cell_element(1, 1);
        grid.set_cell_element(2, 1);
        
        let matches = grid.find_all_matches();
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].pattern, MatchPattern::Line3);
        assert_eq!(matches[0].element, 1);
        assert_eq!(matches[0].cells.len(), 3);
    }

    #[test]
    fn test_vertical_match_line4() {
        let mut grid = create_test_grid(6, 6);
        // Col 0, rows 0-3 -> Element 2 (Wood)
        grid.set_cell_element(0, 2);      // (0,0)
        grid.set_cell_element(6, 2);      // (0,1)
        grid.set_cell_element(12, 2);     // (0,2)
        grid.set_cell_element(18, 2);     // (0,3)
        
        let matches = grid.find_all_matches();
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].pattern, MatchPattern::Line4);
        assert_eq!(matches[0].element, 2);
    }

    #[test]
    fn test_cross_match() {
        let mut grid = create_test_grid(6, 6);
        //  . 1 .
        //  1 1 1
        //  . 1 .
        // Center at (1,1) -> idx 7
        grid.set_cell_element(1, 1);  // (1,0)
        
        grid.set_cell_element(6, 1);  // (0,1)
        grid.set_cell_element(7, 1);  // (1,1)
        grid.set_cell_element(8, 1);  // (2,1)
        
        grid.set_cell_element(13, 1); // (1,2)

        let matches = grid.find_all_matches();
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].pattern, MatchPattern::Cross);
        assert_eq!(matches[0].element, 1);
        assert!(matches[0].cells.len() >= 5);
    }

    #[test]
    fn test_interaction_metal_cuts_wood() {
        // Metal (1) match next to Wood (2)
        let mut grid = create_test_grid(6, 6);
        
        // Match Metal at Bottom Row (Row 5). Idx 30, 31, 32.
        grid.set_cell_element(30, 1);
        grid.set_cell_element(31, 1);
        grid.set_cell_element(32, 1);

        // Wood Neighbor at Row 4 (above Metal).
        // Center of Match is 31 (x=1, y=5).
        // Neighbor above is 31 - 6 = 25.
        // Let's put Wood at 25 (1,4).
        grid.set_cell_element(25, 2);

        // Run Tick to process matches
        grid.tick();

        // 1. Match Cleared
        assert_eq!(grid.get_cell_element(30), 0);
        
        // 2. Interaction: Cross Clear on center (1,5).
        // Cell 25 is Wood. It SHOULD be cleared by Cross Effect.
        assert_eq!(grid.get_cell_element(25), 0);
    }
    
    #[test]
    fn test_interaction_wood_generation() {
        let mut grid = create_test_grid(6, 6);
        
        // Match Wood at Row 5.
        grid.set_cell_element(30, 2);
        grid.set_cell_element(31, 2);
        grid.set_cell_element(32, 2);
        
        // Fire Neighbor at 25 (1,4)
        grid.set_cell_element(25, 4);
        
        assert_eq!(grid.get_cell_element(30), 2);
        
        grid.tick();
        
        // Wood Cleared
        assert_eq!(grid.get_cell_element(30), 0);
        
        // Fire interaction spawns fire events, doesn't clear neighbor
        assert_eq!(grid.get_cell_element(25), 4);
    }
    
    #[test]
    fn test_water_quenches_fire() {
        // Water Match.
        let mut grid = create_test_grid(6, 6);
        
        // Match Water at Row 5.
        grid.set_cell_element(30, 3);
        grid.set_cell_element(31, 3);
        grid.set_cell_element(32, 3);
        
        // Fire Neighbor at 25.
        grid.set_cell_element(25, 4);
        
        // Victim at Row 4, Col 0 (0,4) -> idx 24.
        grid.set_cell_element(24, 1); // Metal
        
        grid.tick();
        
        // Match Cleared
        assert_eq!(grid.get_cell_element(30), 0);
        
        // Interaction: 3x3 Clear.
        assert_eq!(grid.get_cell_element(24), 0);
        
        // (3,5) idx 33 is outside x range (max x=2).
        grid.set_cell_element(33, 5);
    }
}
