(function (window) {
    jsPDF = window.jsPDF

    const sklogolight = window.sklogolight
    const sklogodark = window.sklogodark
    const sklogoratio = window.sklogoratio

    const docSettings = {
        tileWidth: 162,
        tileSpacing: 27,
        heroWidth: 252,
        heroFontSize: 18,
        smallFontSize: 12,
        textSpacing: 2.5,
        baseFontSize: 14,
        lineHeight: 1.15,
        mainColor1: [0, 0, 0],
        mainColor2: [137, 128, 245],
        mainColor3: [35, 157, 209],// Original: [138, 205, 234], made it darker for better contrast
        accentColor1: [34, 147, 195],
        accentColor2: [119, 119, 153],
        pageWidth: 612,
        pageHeight: 792,
        pageMargin: 36,
        headerHeight: 36,
        footerHeight: 27
    }

    // False for dark and True for light
    function textColorFromBackground(r, g, b) {
        let uicolors = [r / 255, g / 255, b / 255]
        let c = uicolors.map((col) => {
            if (col <= 0.03928) {
                return col / 12.92
            }
            return Math.pow((col + 0.055) / 1.055, 2.4)
        })
        let L = (0.2126 * c[0]) + (0.7152 * c[1]) + (0.0722 * c[2])
        return (L > 0.179) ? false : true
    }

    // From James on Stack Overflow
    // https://stackoverflow.com/a/2541680
    // Modified to only sample a cropped portion
    function getAverageRGB(imgEl, cw, ch, sw, sh, sx, sy) {
        let blockSize = 5, // only visit every 5 pixels
            defaultRGB = [0, 0, 0], // for non-supporting envs
            canvas = document.createElement('canvas'),
            context = canvas.getContext && canvas.getContext('2d'),
            data,
            i = -4,
            length,
            rgb = [0, 0, 0],
            count = 0;

        if (!context) {
            return defaultRGB;
        }

        canvas.width = cw;
        canvas.height = ch;

        context.drawImage(imgEl, sx, sy, sw, sh, 0, 0, cw, ch);

        try {
            data = context.getImageData(0, 0, cw, ch);
        } catch (e) {
            /* security error, img on diff domain */
            return defaultRGB;
        }

        // debug
        //canvas.style = 'z-index: 1000; position: fixed; left: 0; top: 0;'; document.body.appendChild(canvas)

        length = data.data.length;

        while ((i += blockSize * 4) < length) {
            ++count;
            rgb[0] += data.data[i];
            rgb[1] += data.data[i + 1];
            rgb[2] += data.data[i + 2];
        }

        // ~~ used to floor values
        rgb[0] = ~~(rgb[0] / count);
        rgb[1] = ~~(rgb[1] / count);
        rgb[2] = ~~(rgb[2] / count);
        return rgb;
    }

    function readFile(file) {
        return new Promise((resolve, reject) => {
            let reader = new FileReader()
            reader.onload = function () {
                resolve(reader.result)
            }
            reader.onerror = function () {
                reject(reader.error)
            }
            reader.readAsDataURL(file)
        })
    }

    async function productTile(doc, x, y, item) {
        doc.saveGraphicsState()

        // Auto-fit the image
        let img = new Image()
        let imgfile = await readFile(item.picture)
        img.src = imgfile
        try {
            await img.decode()
        } catch (e) {
            console.error(e, item.picture)
            throw new Error(`Could not decode image file ${item.picture.name}.`)
        }
        const scaleRatio = Math.max(img.width, img.height) / Math.min(img.width, img.height)
        if (img.height > img.width) {
            doc.addImage(img, x + (docSettings.tileWidth - (docSettings.tileWidth / scaleRatio)) / 2, y, docSettings.tileWidth / scaleRatio, docSettings.tileWidth)
        } else {
            doc.addImage(img, x, y + (docSettings.tileWidth - (docSettings.tileWidth / scaleRatio)) / 2, docSettings.tileWidth, docSettings.tileWidth / scaleRatio)
        }
        y += docSettings.tileWidth + docSettings.textSpacing

        // Brand Text
        let fontsize = docSettings.baseFontSize
        doc.setFont('Montserrat', 'bold')
        doc.setFontSize(fontsize)
        doc.setTextColor(0, 0, 0)
        let brand = doc.splitTextToSize(item.brand, docSettings.tileWidth)
        doc.text(brand, x, y, { baseline: 'top', lineHeightFactor: docSettings.lineHeight })
        y += brand.length * fontsize * docSettings.lineHeight + docSettings.textSpacing

        // Model Text
        fontsize = docSettings.baseFontSize
        doc.setFont('Montserrat', 'normal')
        doc.setFontSize(fontsize)
        doc.setTextColor(...docSettings.accentColor1)
        let model = doc.splitTextToSize(item.model, docSettings.tileWidth)
        doc.text(model, x, y, { baseline: 'top', lineHeightFactor: docSettings.lineHeight })
        y += model.length * fontsize * docSettings.lineHeight + docSettings.textSpacing

        // Flavor Text
        fontsize = docSettings.baseFontSize * 0.8
        doc.setFont('Montserrat', 'italic')
        doc.setFontSize(fontsize)
        doc.setTextColor(0, 0, 0)
        let flavor = doc.splitTextToSize(item.flavor, docSettings.tileWidth)
        doc.text(flavor, x, y, { baseline: 'top', lineHeightFactor: docSettings.lineHeight })
        y += flavor.length * fontsize * docSettings.lineHeight + docSettings.textSpacing

        // Sku Text
        fontsize = docSettings.baseFontSize * 0.8
        doc.setFont('Montserrat', 'normal')
        doc.setFontSize(fontsize)
        doc.setTextColor(...docSettings.accentColor2)
        let sku = item.sku
        doc.text(sku, x, y + (docSettings.baseFontSize * 0.2), { baseline: 'top', lineHeightFactor: docSettings.lineHeight })

        // Price Text
        fontsize = docSettings.baseFontSize
        doc.setFont('Montserrat', 'normal')
        doc.setFontSize(fontsize)
        doc.setTextColor(0, 0, 0)
        let price = item.price
        doc.text(price, x + docSettings.tileWidth, y, { baseline: 'top', lineHeightFactor: docSettings.lineHeight, align: 'right' })
        y += fontsize * docSettings.lineHeight

        // Dispose of image
        img = null

        doc.restoreGraphicsState()
        return y
    }

    function measureTile(doc, item) {
        doc.saveGraphicsState()

        // After tile picture
        let y = docSettings.tileWidth + docSettings.textSpacing
        // After Brand text
        let fontsize = docSettings.baseFontSize
        doc.setFontSize(fontsize)
        doc.setFont('Montserrat', 'bold')
        y += doc.splitTextToSize(item.brand, docSettings.tileWidth).length * fontsize * docSettings.lineHeight + docSettings.textSpacing
        // After Model text
        doc.setFont('Montserrat', 'normal')
        y += doc.splitTextToSize(item.model, docSettings.tileWidth).length * fontsize * docSettings.lineHeight + docSettings.textSpacing
        // After Flavor text
        doc.setFontSize(fontsize * 0.8)
        doc.setFont('Montserrat', 'italic')
        y += doc.splitTextToSize(item.flavor, docSettings.tileWidth).length * (fontsize * 0.8) * docSettings.lineHeight + docSettings.textSpacing
        // After Price text
        y += fontsize * docSettings.lineHeight

        doc.restoreGraphicsState()
        return y
    }

    async function productHero(doc, y, item) {
        doc.saveGraphicsState()

        let imgx = docSettings.pageMargin
        let textx = docSettings.pageMargin + docSettings.heroWidth + 18
        let textWidth = docSettings.heroWidth + 18
        let descSpacing = docSettings.textSpacing * 2

        // Brand Text
        let fontsize = docSettings.heroFontSize
        doc.setFont('Montserrat', 'bold')
        doc.setFontSize(fontsize)
        doc.setTextColor(0, 0, 0)
        let brand = doc.splitTextToSize(item.brand, textWidth)
        doc.text(brand, textx, y, { baseline: 'top', lineHeightFactor: docSettings.lineHeight })
        let texty = y + brand.length * fontsize * docSettings.lineHeight + docSettings.textSpacing

        // Model Text
        fontsize = docSettings.heroFontSize
        doc.setFont('Montserrat', 'normal')
        doc.setFontSize(fontsize)
        doc.setTextColor(...docSettings.accentColor1)
        let model = doc.splitTextToSize(item.model, textWidth)
        doc.text(model, textx, texty, { baseline: 'top', lineHeightFactor: docSettings.lineHeight })
        texty += model.length * fontsize * docSettings.lineHeight + docSettings.textSpacing * 2

        // Flavors
        for (let i = 0; i < item.setItems.length; i++) {
            doc.setFont('Montserrat', 'normal')
            doc.setFontSize(docSettings.smallFontSize * 0.8)
            let skuWidth = doc.getStringUnitWidth(item.setItems[i].sku) * (docSettings.smallFontSize * 0.8)
            doc.setFontSize(docSettings.smallFontSize)
            let priceWidth = doc.getStringUnitWidth(item.setItems[i].price) * docSettings.smallFontSize
            doc.setFont('Montserrat', 'italic')
            doc.setTextColor(0, 0, 0)
            let flavorWidth = textWidth - skuWidth - priceWidth - descSpacing * 2
            let flavor = doc.splitTextToSize(item.setItems[i].flavor, flavorWidth)
            let flavorHeight = flavor.length * docSettings.smallFontSize * docSettings.lineHeight
            doc.text(flavor, textx + skuWidth + descSpacing, texty, { baseline: 'top', lineHeightFactor: docSettings.lineHeight })
            doc.setFont('Montserrat', 'normal')
            doc.setFontSize(docSettings.smallFontSize * 0.8)
            doc.setTextColor(...docSettings.accentColor2)
            doc.text(item.setItems[i].sku, textx, texty + flavorHeight / 2, { baseline: 'middle', lineHeightFactor: docSettings.lineHeight })
            doc.setFontSize(docSettings.smallFontSize)
            doc.setTextColor(0, 0, 0)
            doc.text(item.setItems[i].price, textx + skuWidth + flavorWidth + descSpacing * 2, texty + flavorHeight / 2, { baseline: 'middle', lineHeightFactor: docSettings.lineHeight })
            texty += flavorHeight + docSettings.textSpacing
        }

        // Auto-fit the image
        let img = new Image()
        let imgfile = await readFile(item.picture)
        img.src = imgfile
        await img.decode()
        const scaleRatio = Math.max(img.width, img.height) / Math.min(img.width, img.height)
        let imgy = y
        imgy += (texty - y - Math.min(texty - y, docSettings.heroWidth)) / 2
        if (img.height > img.width) {
            doc.addImage(img, imgx + (docSettings.heroWidth - (docSettings.heroWidth / scaleRatio)) / 2, imgy, docSettings.heroWidth / scaleRatio, docSettings.heroWidth)
        } else {
            doc.addImage(img, imgx, imgy + (docSettings.heroWidth - (docSettings.heroWidth / scaleRatio)) / 2, docSettings.heroWidth, docSettings.heroWidth / scaleRatio)
        }

        // Dispose of image
        img = null

        doc.restoreGraphicsState()
        return Math.max(texty, y + docSettings.heroWidth)
    }

    function measureHero(doc, item) {
        doc.saveGraphicsState()

        let y = 0
        let fontsize = docSettings.heroFontSize
        let textWidth = docSettings.heroWidth + 18
        let descSpacing = docSettings.textSpacing * 2
        doc.setFontSize(fontsize)

        doc.setFont('Montserrat', 'bold')
        let brand = doc.splitTextToSize(item.brand, textWidth)
        y += brand.length * fontsize * docSettings.lineHeight + docSettings.textSpacing

        doc.setFont('Montserrat', 'normal')
        let model = doc.splitTextToSize(item.model, textWidth)
        y += model.length * fontsize * docSettings.lineHeight + docSettings.textSpacing * 2

        for (let i = 0; i < item.setItems.length; i++) {
            doc.setFont('Montserrat', 'normal')
            doc.setFontSize(docSettings.smallFontSize * 0.8)
            let skuWidth = doc.getStringUnitWidth(item.setItems[i].sku) * (docSettings.smallFontSize * 0.8)
            doc.setFontSize(docSettings.smallFontSize)
            let priceWidth = doc.getStringUnitWidth(item.setItems[i].price) * docSettings.smallFontSize
            doc.setFont('Montserrat', 'italic')
            let flavorWidth = textWidth - skuWidth - priceWidth - descSpacing * 2
            let flavor = doc.splitTextToSize(item.setItems[i].flavor, flavorWidth)
            let flavorHeight = flavor.length * docSettings.smallFontSize * docSettings.lineHeight
            y += flavorHeight + docSettings.textSpacing
        }

        doc.restoreGraphicsState()
        return Math.max(y, docSettings.heroWidth)
    }

    function header(doc, pageSide, title) {
        doc.saveGraphicsState()

        let logoWidth = 36 * sklogoratio
        let spacing = 4
        let band1Width = 36
        let band2Width = 72

        doc.setFont('Montserrat', 'bold')
        doc.setFontSize(28)
        doc.setTextColor(255, 255, 255)

        if (pageSide === 'left') {
            doc.addImage(sklogodark, docSettings.pageMargin, docSettings.pageMargin, logoWidth, docSettings.headerHeight)
            doc.setFillColor(...docSettings.mainColor1)
            doc.rect(docSettings.pageMargin + logoWidth + spacing, docSettings.pageMargin, band1Width, docSettings.headerHeight, 'F')
            doc.setFillColor(...docSettings.mainColor2)
            doc.rect(docSettings.pageMargin + logoWidth + spacing + band1Width, docSettings.pageMargin, band2Width, docSettings.headerHeight, 'F')
            doc.setFillColor(...docSettings.mainColor3)
            let band3width = docSettings.pageWidth - docSettings.pageMargin * 2 - logoWidth - spacing - band1Width - band2Width
            doc.rect(docSettings.pageMargin + logoWidth + spacing + band1Width + band2Width, docSettings.pageMargin, band3width, docSettings.headerHeight, 'F')
            doc.text(title, docSettings.pageWidth - docSettings.pageMargin - spacing, docSettings.headerHeight + spacing, { baseline: 'top', lineHeightFactor: docSettings.lineHeight, align: 'right' })
        } else {
            doc.addImage(sklogodark, docSettings.pageWidth - docSettings.pageMargin - logoWidth, docSettings.pageMargin, logoWidth, docSettings.headerHeight)
            doc.setFillColor(...docSettings.mainColor1)
            doc.rect(docSettings.pageWidth - docSettings.pageMargin - logoWidth - spacing - band1Width, docSettings.pageMargin, band1Width, docSettings.headerHeight, 'F')
            doc.setFillColor(...docSettings.mainColor2)
            doc.rect(docSettings.pageWidth - docSettings.pageMargin - logoWidth - spacing - band1Width - band2Width, docSettings.pageMargin, band2Width, docSettings.headerHeight, 'F')
            doc.setFillColor(...docSettings.mainColor3)
            let band3width = docSettings.pageWidth - docSettings.pageMargin * 2 - logoWidth - spacing - band1Width - band2Width
            doc.rect(docSettings.pageWidth - docSettings.pageMargin - logoWidth - spacing - band1Width - band2Width - band3width, docSettings.pageMargin, band3width, docSettings.headerHeight, 'F')
            doc.text(title, docSettings.pageMargin + spacing, docSettings.headerHeight + spacing, { baseline: 'top', lineHeightFactor: docSettings.lineHeight })
        }

        doc.restoreGraphicsState()
    }

    function footer(doc, pageSide, pageNumber, subtitle) {
        doc.saveGraphicsState()

        let spacing = 4

        doc.setFillColor(...docSettings.mainColor3)
        doc.rect(docSettings.pageMargin, docSettings.pageHeight - docSettings.pageMargin - 27, docSettings.pageWidth - docSettings.pageMargin * 2, docSettings.footerHeight, 'F')

        if (pageSide === 'left') {
            doc.setFont('Montserrat', 'light')
            doc.setFontSize(16)
            doc.setTextColor(255, 255, 255)
            doc.text(subtitle, docSettings.pageWidth - docSettings.pageMargin - spacing, docSettings.pageHeight - docSettings.pageMargin - 20, { baseline: 'top', lineHeightFactor: docSettings.lineHeight, align: 'right' })
            doc.setFont('Montserrat', 'bold')
            doc.setFontSize(docSettings.footerHeight)
            doc.text(String(pageNumber), docSettings.pageMargin + spacing, docSettings.pageHeight - docSettings.pageMargin - docSettings.footerHeight, { baseline: 'top', lineHeightFactor: docSettings.lineHeight })
        } else {
            doc.setFont('Montserrat', 'light')
            doc.setFontSize(16)
            doc.setTextColor(255, 255, 255)
            doc.text(subtitle, docSettings.pageMargin + spacing, docSettings.pageHeight - docSettings.pageMargin - 20, { baseline: 'top', lineHeightFactor: docSettings.lineHeight })
            doc.setFont('Montserrat', 'bold')
            doc.setFontSize(docSettings.footerHeight)
            doc.text(String(pageNumber), docSettings.pageWidth - docSettings.pageMargin - spacing, docSettings.pageHeight - docSettings.pageMargin - docSettings.footerHeight, { baseline: 'top', lineHeightFactor: docSettings.lineHeight, align: 'right' })
        }

        doc.restoreGraphicsState()
    }

    async function coverPage(doc, coverTitle, coverColorOrPicture, logoPosition = 'middle') {
        doc.saveGraphicsState()

        let backcolor = [0, 0, 0]
        let lightTitles = true
        let img = null

        let backX = 0
        let backY = 0
        let backWidth = 0
        let backHeight = 0

        if (Array.isArray(coverColorOrPicture)) {
            // We have a background color
            backcolor = coverColorOrPicture
            doc.setFillColor(...backcolor)
            doc.rect(0, 0, docSettings.pageWidth, docSettings.pageHeight, 'F')
        } else {
            // We have a background picture
            img = new Image()
            let imgfile = await readFile(coverColorOrPicture)
            img.src = imgfile
            await img.decode()

            const scaleRatio = Math.max(img.width, img.height) / Math.min(img.width, img.height)
            if (img.height > img.width && scaleRatio > 1.01) {
                backWidth = docSettings.pageWidth
                backHeight = backWidth * scaleRatio
                backX = 0
                backY = docSettings.pageHeight / 2 - backHeight / 2
                doc.addImage(img, 'JPEG', backX, backY, backWidth, backHeight)
            } else {
                backHeight = docSettings.pageHeight
                backWidth = backHeight * scaleRatio
                backX = docSettings.pageWidth / 2 - backWidth / 2
                backY = 0
                doc.addImage(img, 'JPEG', backX, backY, backWidth, backHeight)
            }
        }

        let fontsize = docSettings.baseFontSize * 2
        doc.setFont('Montserrat', 'light')
        doc.setFontSize(fontsize)

        let logoWidth = (docSettings.pageWidth - docSettings.pageMargin) / 2
        let logoHeight = logoWidth / sklogoratio
        coverTitle = doc.splitTextToSize(coverTitle, logoWidth)
        let textHeight = coverTitle.length * fontsize * docSettings.lineHeight
        let spacing = 12
        let totalHeight = logoHeight + spacing + textHeight
        let x = docSettings.pageWidth - docSettings.pageMargin - logoWidth
        let y = 0
        if (logoPosition === 'top') {
            y = docSettings.pageMargin
        } else if (logoPosition === 'middle') {
            y = docSettings.pageHeight / 2 - totalHeight / 2
        } else {
            y = docSettings.pageHeight - totalHeight - docSettings.pageMargin
        }
        if (img) {
            backcolor = getAverageRGB(img, logoWidth, totalHeight, logoWidth * img.width / backWidth, totalHeight * img.height / backHeight, (x - backX) * img.width / backWidth, (y - backY) * img.height / backHeight)
        }
        lightTitles = textColorFromBackground(...backcolor)
        lightTitles ? doc.setTextColor(255, 255, 255) : doc.setTextColor(0, 0, 0)

        // debug
        //doc.setFillColor(...backcolor); doc.rect(0, docSettings.pageHeight - 72, 72, 72, 'F')

        doc.addImage(lightTitles ? sklogolight : sklogodark, 'PNG', x, y, logoWidth, logoHeight)
        doc.text(coverTitle, x, y + logoHeight + spacing, { baseline: 'top', lineHeightFactor: docSettings.lineHeight })

        // Dispose of image
        img = null

        doc.restoreGraphicsState()
    }

    function calculateRow(doc, row) {
        let largestSize = 0
        for (let i = 0; i < row.items.length; i++) {
            let itemSize = 0
            if (row.items[i].isSet) {
                itemSize = measureHero(doc, row.items[i])
            } else {
                itemSize = measureTile(doc, row.items[i])
            }
            largestSize = Math.max(largestSize, itemSize)
        }
        row.usedSpace = largestSize
    }

    function fitOnPage(doc, pages, row) {
        // This is the total space available on the page for rows
        const allocSpace = docSettings.pageHeight - docSettings.pageMargin * 2 - docSettings.headerHeight - docSettings.footerHeight

        calculateRow(doc, row)
        // Do they fit in the last page? If yes we place them
        let curPage = pages[pages.length - 1]
        if (row.usedSpace < curPage.remainingSpace) {
            curPage.rows.push(row)
            curPage.remainingSpace -= row.usedSpace
            // They don't fit so we create a page just for them...
        } else {
            pages.push({ title: row.items[0].title, subtitle: row.items[0].subtitle, remainingSpace: allocSpace - row.usedSpace, rows: [row] })
        }
    }

    function splitIntoPages(doc, items) {
        let pages = []

        // This is the total space available on the page for rows
        const allocSpace = docSettings.pageHeight - docSettings.pageMargin * 2 - docSettings.headerHeight - docSettings.footerHeight

        let curCat = ''
        let curRow = { usedSpace: 0, items: [] }

        // We iterate over every item and place them in rows
        for (let i = 0; i < items.length; i++) {
            // We check if we need to create a new page for a new section
            if (curCat !== items[i].title) {
                // Do we have left over items from the last section ?
                if (curRow.items.length > 0) {
                    fitOnPage(doc, pages, curRow)
                    curRow = { usedSpace: 0, items: [] }
                }
                pages.push({ title: items[i].title, subtitle: items[i].subtitle, remainingSpace: allocSpace, rows: [] })
                curCat = items[i].title
            }

            // Now that we've dealt with pages, it's time to look at our item
            // First, we add the item to the row
            if (items[i].isSet && curRow.items.length > 0) {
                // Sets are alone in a row so we clear that up first
                fitOnPage(doc, pages, curRow)
                curRow = { usedSpace: 0, items: [] }
            }
            curRow.items.push(items[i])

            // Then, we check if the row is full
            if ((items[i].isSet && curRow.items.length > 0) || (curRow.items.length > 2)) {
                // row is full, we calculate it and clear it up
                fitOnPage(doc, pages, curRow)
                curRow = { usedSpace: 0, items: [] }
            }
        }

        // We're done cycling through our items, yay!
        // But before we leave, we need to made sure we don't have leftovers on the table
        if (curRow.items.length > 0) {
            fitOnPage(doc, pages, curRow)
        }

        return pages
    }

    async function generatePDF(items, coverInfo) {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'letter',
            putOnlyUsedFonts: true
        })
        doc.setDocumentProperties({
            title: coverInfo.title,
            subject: coverInfo.title,
            author: 'Sutekina Institute',
            keywords: 'Sutekina Institute Product Catalogue',
            creator: 'Catalogue Generator by J-F Desrochers'
        })
        doc.setDisplayMode('fullpage', 'tworight', 'UseThumbs')
        await coverPage(doc, coverInfo.title, coverInfo.pictureOrColor, coverInfo.logoPosition)
        let pages = splitIntoPages(doc, items)
        for (let i = 0; i < pages.length; i++) {
            doc.addPage()
            let pageDirection = i % 2 === 0 ? 'left' : 'right'
            // Divide space equally between header, footer and rows
            let pageSpacing = pages[i].remainingSpace / (pages[i].rows.length + 1)

            header(doc, pageDirection, pages[i].title)
            footer(doc, pageDirection, i + 1, pages[i].subtitle)

            let y = docSettings.pageMargin + docSettings.headerHeight + pageSpacing
            for (let row = 0; row < pages[i].rows.length; row++) {
                let rowh = 0
                if (pages[i].rows[row].items[0].isSet) {
                    rowh = await productHero(doc, y, pages[i].rows[row].items[0])
                } else {
                    let x = docSettings.pageMargin
                    for (let item = 0; item < pages[i].rows[row].items.length; item++) {
                        let itemh = await productTile(doc, x, y, pages[i].rows[row].items[item])
                        rowh = Math.max(itemh, rowh)
                        x += docSettings.tileWidth + docSettings.tileSpacing
                    }
                }
                y = rowh + pageSpacing
            }
        }
        return doc.output('bloburl')
    }
    window.generatePDF = generatePDF
})(window)