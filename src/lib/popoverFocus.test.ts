import { afterEach, describe, expect, it } from 'vitest'
import { containsFocus, registerPopover } from './popoverFocus'

function el(tag = 'div'): HTMLElement {
  return document.createElement(tag)
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('containsFocus', () => {
  it('is false when the container or the node is missing', () => {
    const container = el()
    expect(containsFocus(null, container)).toBe(false)
    expect(containsFocus(container, null)).toBe(false)
  })

  it('is true for the container itself and nodes inside it', () => {
    const container = el()
    const input = el('input')
    container.appendChild(input)
    document.body.appendChild(container)
    expect(containsFocus(container, container)).toBe(true)
    expect(containsFocus(container, input)).toBe(true)
  })

  it('is false for a node outside the container', () => {
    const container = el()
    const outside = el('button')
    document.body.append(container, outside)
    expect(containsFocus(container, outside)).toBe(false)
  })

  it('counts focus inside a registered popover as inside its owner field', () => {
    const container = el()
    const owner = el('input')
    container.appendChild(owner)
    const popover = el()
    const option = el('button')
    popover.appendChild(option)
    document.body.append(container, popover)

    registerPopover(popover, owner)

    expect(popover.hasAttribute('data-portal-popover')).toBe(true)
    expect(containsFocus(container, option)).toBe(true)
    expect(containsFocus(container, popover)).toBe(true)
  })

  it('handles a text node inside a registered popover', () => {
    const container = el()
    const owner = el('input')
    container.appendChild(owner)
    const popover = el()
    const text = document.createTextNode('option')
    popover.appendChild(text)
    document.body.append(container, popover)
    registerPopover(popover, owner)

    expect(containsFocus(container, text)).toBe(true)
  })

  it('does not count a popover owned by a different field', () => {
    const container = el()
    const otherField = el()
    const otherOwner = el('input')
    otherField.appendChild(otherOwner)
    const popover = el()
    const option = el('button')
    popover.appendChild(option)
    document.body.append(container, otherField, popover)
    registerPopover(popover, otherOwner)

    expect(containsFocus(container, option)).toBe(false)
    expect(containsFocus(otherField, option)).toBe(true)
  })

  it('does not count an unregistered portal element', () => {
    const container = el()
    const stray = el()
    stray.setAttribute('data-portal-popover', '')
    const option = el('button')
    stray.appendChild(option)
    document.body.append(container, stray)

    expect(containsFocus(container, option)).toBe(false)
  })
})
