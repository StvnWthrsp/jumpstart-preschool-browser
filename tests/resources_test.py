import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from resources import unpack_rle


class BitmapTests(unittest.TestCase):
    def test_restore_background_is_distinct_from_literal_white(self):
        # Lookup index 255 restores the background; literal index 255 is white.
        packed = bytes([2, 0, 255, 0, 0, 1, 255, 1, 255])
        pixels, mask = unpack_rle(packed, 2, 1, with_restore=True)
        self.assertEqual(pixels, bytes([0, 255]))
        self.assertEqual(mask, bytes([1, 0]))


if __name__ == '__main__':
    unittest.main()
