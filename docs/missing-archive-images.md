# Missing archive images

These season screenshots are referenced from `public/scripts/data.js` and are not in `public/images/`. They are real gaps in the archive, not files this repository should invent.

| Season | Expected file |
| --- | --- |
| 2008/09 | `public/images/2009.png` |
| 2009/10 | `public/images/2010.png` |
| 2010/11 | `public/images/2011.png` |
| 2011/12 | `public/images/2012.png` |
| 2012/13 | `public/images/2013.png` |
| 2013/14 | `public/images/2014.png` |
| 2014/15 | `public/images/2015.png` |
| 2016/17 | `public/images/2017.png` |
| 2018/19 | `public/images/2019.png` |
| 2020/21 | `public/images/2021.png` |

`MISSING_ARCHIVE_IMAGES` in `public/scripts/data.js` lists the same paths. The season lightbox shows “Screenshot not available for this season yet.” for each of them and does not request the file. A screenshot that is not on this list still uses the image error handler if the file fails to load.

The files that are present are `2016.png`, `2018.png`, `2020.png`, `2022.png`, `2023.png`, `2024.png`, `2025.png`, and `2026.png`, plus `fpllogo.png` and `the-abusement-park-social.png`.

When a real screenshot is added, put it at the path above and remove that path from `MISSING_ARCHIVE_IMAGES`.
