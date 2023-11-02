import * as lib from '/lib.js'

// TODO update indentation
document.body.classList.add('d-none')

if (!(window.chrome || window.browser)) {
    // it is not extension context, 
    // means it is context to test markup
    document.body.classList.remove('d-none')
}

const urlElt = document.querySelector('.origin-tab-info-url')
const goBtnElt = document.querySelector('.btn-main')
const errorElt = document.querySelector('.error-label')

let tabOriginData = {
    // initially just a placeholder url for tests
    url: 'https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions'
}

errorElt.addEventListener('click', e => {
    if (errorElt.classList.contains('active'))
        navigator.clipboard.writeText(errorElt.innerText)
})

// restores visible url after text has faded-out
function restoreUrl(e) {
    if (e.propertyName == 'color') {
        const animClass = 'fade-out-text'
        urlElt.classList.remove(animClass)
        urlElt.value = urlElt.dataset.originUrl
    }
}

// urlElt.addEventListener('transitioncancel', restoreUrl)
urlElt.addEventListener('transitionend', restoreUrl)

urlElt.addEventListener('click', _ => {

    navigator.clipboard.writeText(urlElt.dataset.originUrl)

    const animClass = 'fade-out-text'

    if (urlElt.classList.contains(animClass)) {
        urlElt.classList.remove(animClass)
        urlElt.value = urlElt.dataset.originUrl
    } else {
        urlElt.value = 'copied!'
        urlElt.classList.add(animClass)
    }
})

function setErrorText(text) {
    errorElt.textContent = text
    errorElt.classList.add('active')
}

// expose `setErrorText` for tests
window.setErrorText = setErrorText

function focusTab() {
    const { tabId, windowId } = tabOriginData
    lib.focusTab(tabId, windowId)
    window.close()
}

function createTab() {
    const { url, currentTabIndex, currentTabId} = tabOriginData
    const tabId = currentTabId.toString()

    chrome.storage.local.get(tabId)
        .then(data => {
            const historyStack = data[tabId] || []
            lib.createTab(url, currentTabIndex, historyStack)
                    .then(_ => window.close())
                    .catch(e => {
                        console.error('Cannot create tab.', e.message)
                        setErrorText(e.message)
                        chrome.action.setBadgeText({ text: "N/A", tabId: currentTabId })
                    })
        })
}

lib.sendMessage(lib.TAB_ORIGIN_DATA_MSG, null)
    .then(response => {

        tabOriginData = response

        // url can be undefined since it resets
        // every time user clicks extension button
        const url = tabOriginData?.url

        if (url) {
            document.body.classList.remove('d-none')

            urlElt.value = url
            urlElt.dataset.originUrl = url

            if (response.tabId !== undefined) {
                // 	- tab is already open(but not active), you can switch to it

                goBtnElt.onclick = focusTab
                goBtnElt.innerText = 'Go to Tab'
                
            } else if (response.currentTabId !== undefined) {
                //	- tab is not open at all, you can open it
                
                goBtnElt.onclick = createTab
                goBtnElt.innerText = 'Open Tab'
            }
        } else {
            window.close()
        }
    })
    .catch(err => {
        // for some reason there might be no response from bg script
        // e.g. bg script was unload from memory
        // (we cannot make persistent bg scripts in Manifest V3)
        console.error(err);
        setErrorText(e.message)
    })

document.querySelector('.btn-open-ext-settings')
    .addEventListener('click', e => {
        e.preventDefault()
        chrome.runtime.openOptionsPage()
    })

document.querySelectorAll('.origin-tab-info-footer a')
    .forEach(elt => elt.addEventListener('click', _ => window.close()))

lib.getActionType().then(actionType => {
    switch (actionType) {
        case lib.actionType.OPEN_TAB:

            // normally this branch should never be executed
            console.warn('popup should not be open for "OPEN TAB" action, closing it');
            window.close()
            break
    }
})
