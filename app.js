const m = window.m
const xlsx = window.XLSX

const sklogo = window.sklogodark
const version = 'VERSION1'

let itemLists = []
let itemPics = {}
let loadingCount = -1
let coverInfo = {
    title: localStorage.getItem('SutekinaCatalogue.Title') || '',
    pictureOrColor: [0, 0, 0],
    logoPosition: 'top'
}
let pdfUrl = ''


let loadError = ''

function checkLoadedPics () {
    let loadedCount = 0
    for (let pic in itemPics) {
        if (itemPics[pic]) loadedCount++
    }
    loadingCount = itemLists.length - loadedCount
    if (loadingCount === 0) {
        for (let i = 0; i < itemLists.length; i++) {
            itemLists[i].picture = itemPics[itemLists[i].sku]
        }
    }
}

async function doGenerate() {
    let loading = document.getElementById('loading')
    try {
        pdfUrl = await generatePDF(itemLists, coverInfo)
    } catch (e) {
        loadError = 'An error occured while generating the PDF. ' + e.message
    }
    loading.classList.remove('show')
    m.redraw()
}

class CatalogueLoader {
    constructor () {
        this.coverType = 'Color'
        this.selectCoverType = this.selectCoverType.bind(this)
    }

    handlePictureLoad (e) {
        let files = e.target.files
        for (let i = 0; i < files.length; i++) {
            let fname = files[i].name.split('.')[0]
            if (fname in itemPics) {
                itemPics[fname] = files[i]
            }
        }
        checkLoadedPics()
    }

    handleFileLoad (e) {
        loadError = ''
        let files = e.target.files
        if (files.length === 0) return;
        let file = files[0]
        let reader = new FileReader()
        itemLists = []
        itemPics = {}
        loadingCount = -1
        if (pdfUrl.length > 0) {
            URL.revokeObjectURL(pdfUrl)
            pdfUrl = ''
        }
        coverInfo = {
            title: localStorage.getItem('SutekinaCatalogue.Title') || '',
            pictureOrColor: [0, 0, 0],
            logoPosition: 'top'
        }
        try {
            reader.readAsArrayBuffer(file)
            reader.onload = (evt) => {
                // Load Excel File
                let data = new Uint8Array(evt.target.result)
                const book = xlsx.read(data, {type: 'array'})
                const sheet = book.Sheets['Retail Sheet']
                // Ensure the file has correct data
                if (!sheet) {
                    console.error('Expected a Retail Sheet but not found. Sheets in this file:', book.Sheets)
                    loadError = 'This file needs to have a "Retail Sheet".'
                    m.redraw()
                    return
                }
                if (!sheet['!ref']) {
                    console.error('Found a Retail Sheet, but it did not have any content. Sheets in this file:', book.Sheets)
                    loadError = 'This file needs to have a "Retail Sheet" that is not empty.'
                    m.redraw()
                    return
                }
                if (!sheet['A1'].c || sheet['A1'].c[0].t !== version) {
                    loadError = `The version of this file is wrong. Expected ${version}, found ${sheet['A1'].c ? sheet['A1'].c[0].t : 'None'}.`
                    m.redraw()
                    return
                }

                const range = xlsx.utils.decode_range(book.Sheets['Retail Sheet']['!ref'])
                itemLists = []
                for (let i = 1; i <= range.e.r; i++) {
                    let idx = String(i + 1)
                    if (!sheet['A' + idx]) continue
                    let setsku = sheet['E' + idx] ? sheet['E' + idx].v : undefined
                    if (setsku) {
                        if (itemLists.length > 0 && itemLists[itemLists.length - 1].sku === setsku) {
                            itemLists[itemLists.length - 1].setItems.push({
                                flavor: sheet['G' + idx].v,
                                sku: sheet['D' + idx].v,
                                price: sheet['H' + idx].v + '.00'
                            })
                        } else {
                            itemLists.push({
                                title: sheet['A' + idx].v,
                                subtitle: sheet['B' + idx].v,
                                brand: sheet['C' + idx].v,
                                model: sheet['F' + idx].v,
                                flavor: '',
                                sku: setsku,
                                price: '',
                                isSet: true,
                                setItems: [{
                                    flavor: sheet['G' + idx].v,
                                    sku: sheet['D' + idx].v,
                                    price: sheet['H' + idx].v + '.00'
                                }],
                                picture: null
                            })
                            itemPics[setsku] = null
                        }
                    } else {
                        itemLists.push({
                            title: sheet['A' + idx].v,
                            subtitle: sheet['B' + idx].v,
                            brand: sheet['C' + idx].v,
                            model: sheet['F' + idx].v,
                            flavor: sheet['G' + idx].v,
                            sku: sheet['D' + idx].v,
                            price: sheet['H' + idx].v + '.00',
                            isSet: false,
                            setItems: [],
                            picture: null
                        })
                        itemPics[sheet['D' + idx].v] = null
                    }
                }
                loadingCount = itemLists.length
                m.redraw()
            }
            reader.onerror = (err) => {
                loadError = 'Unable to load the definition file. Please make sure that you\'ve exported it correctly.'
                console.error(err)
                m.redraw()
            }
        } catch (err) {
            loadError = 'Unable to load the definition file. Please make sure that you\'ve exported it correctly.'
            console.error(err)
            m.redraw()
        }
    }

    handleColorChange (e) {
        let hexColor = e.target.value
        let colR = parseInt(hexColor.slice(1, 3), 16)
        let colG = parseInt(hexColor.slice(3, 5), 16)
        let colB = parseInt(hexColor.slice(5, 7), 16)
        coverInfo.pictureOrColor =  [colR, colG, colB]
    }

    handleCoverPicture (e) {
        let files = e.target.files
        if (files.length === 0) return
        coverInfo.pictureOrColor = files[0]
    }

    handleTitleChange (e) {
        coverInfo.title = e.target.value
        localStorage.setItem('SutekinaCatalogue.Title', coverInfo.title)
    }

    handleGenerate (e) {
        e.preventDefault()
        loadError = ''
        if (pdfUrl.length > 0) {
            URL.revokeObjectURL(pdfUrl)
            pdfUrl = ''
        }
        let loading = document.getElementById('loading')
        loading.classList.add('show')
        setTimeout(doGenerate, 1000)
    }

    handleReload (e) {
        e.preventDefault()
        window.location.reload()
    }

    selectCoverType (e) {
        this.coverType = e.target.value
        if (this.coverType === 'Color') {
            coverInfo.pictureOrColor = [0, 0, 0]
        } else {
            coverInfo.pictureOrColor = null
        }
    }

    selectCoverLogoPosition (e) {
        coverInfo.logoPosition = e.target.value
    }

    view () {
        return [
            m('.list-loader', pdfUrl.length > 0 ? [
                m('.step.success', [
                    m('h2.step-title', 'PDF successfully generated!'),
                    m('h3.step-subtitle', 'Your PDF catalogue has been successfully generated. You can consult it on the side and download it or start over using the buttons below.'),
                    m('a.btn.mr-15', {href: pdfUrl, download: coverInfo.title + '.pdf'}, 'Download'),
                    m('button.btn', {onclick: this.handleReload}, 'Start over')
                ])
            ] : [
                m('img.list-logo', { src: sklogo }),
                loadError ? m('.load-error', loadError) : '',
                m('.step', [
                    m('h2.step-title', 'Step 1 - Definition file'),
                    m('h3.step-subtitle', 'Please open your Excel Catalogue Definition File using the form below. It will be loaded automatically.'),
                    m('input#xlsfile', {type: 'file', accept: '.xlsx, .xls', onchange: this.handleFileLoad})
                ]),
                itemLists.length > 0 ? m('.step', [
                    m('h2.step-title', 'Step 2 - Catalogue Pictures'),
                    m('h3.step-subtitle', 'Please open your catalogue pictures for the SKUs listed below. The pictures can be JPEG, PNG or WEBP. Note that you can open multiple pictures at once.'),
                    m('input#picfiles', {type: 'file', accept: 'image/jpeg, image/png, image/webp', multiple: true, onchange: this.handlePictureLoad}),
                    loadingCount > 0 ? m('h4', `You need to load ${loadingCount} more picture(s).`) : m('h4.found', 'All pictures have been loaded successfully.'),
                    loadingCount > 0 ? m('.skulist', Object.keys(itemPics).map((pic) => {
                        return m(itemPics[pic] ? '.found' : '.not-found', pic)
                    })) : ''
                ]) : '',
                loadingCount === 0 ? m('.step', [
                    m('h2.step-title', 'Step 3 - Catalogue Cover'),
                    m('h3.step-subtitle', 'Finally, let\'s give your catalogue a snazzy title and a cool cover picture or color. You can also decide where to place the logo on the cover.'),
                    m('p', 'Choose if you prefer a color or a picture on your cover:'),
                    m('select.cover-select', {onchange: this.selectCoverType}, [
                        m('option', 'Color'),
                        m('option', 'Picture')
                    ]),
                    this.coverType === 'Color' ? m('input.color-select', {type: 'color', onchange: this.handleColorChange, defaultValue: '#000000'})
                                            : m('input.picture-select', {type: 'file', accept: 'image/jpeg, image/png, image/webp', onchange: this.handleCoverPicture}),
                    m('p', 'Desired position of the logo on the cover:'),
                    m('select.cover-select', {onchange: this.selectCoverLogoPosition}, [
                        m('option', 'top'),
                        m('option', 'middle'),
                        m('option', 'bottom')
                    ]),
                    m('p', 'Give your catalogue a title:'),
                    m('input.cover-select.full', {value: coverInfo.title, oninput: this.handleTitleChange}),
                    m('button.btn', {disabled: (coverInfo.title.length === 0 || !coverInfo.pictureOrColor), onclick: this.handleGenerate}, 'Generate PDF')
                ]) : ''
            ]),
            pdfUrl.length > 0 ? m('iframe.pdfdoc', {src: pdfUrl}) : ''
        ]
    }
}

m.mount(document.getElementById('container'), CatalogueLoader)