import React, { Component } from 'react'
import TextareaAutosize from 'react-autosize-textarea'
import { Mutation } from 'react-apollo'
import trim from 'lodash/trim'
import { fbt } from 'fbt-runtime'

import mutation from 'mutations/SendMessage'
import withConfig from 'hoc/withConfig'

import { postFile } from 'utils/fileUtils'
import pasteIntoInput from 'utils/pasteIntoInput'

import ToastMessage from 'components/ToastMessage'

const acceptedFileTypes = ['image/jpeg', 'image/pjpeg', 'image/png']

async function getImages(config, files) {
  const { ipfsGateway, ipfsRPC } = config

  const newImages = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const hash = await postFile(ipfsRPC, file)
    if (acceptedFileTypes.indexOf(file.type) >= 0) {
      newImages.push({
        contentType: file.type,
        url: `${ipfsGateway}/ipfs/${hash}`
      })
    }
  }
  return newImages
}

class SendMessage extends Component {
  constructor(props) {
    super(props)

    this.fileInput = React.createRef()
    this.input = React.createRef()
    this.handleClick = this.handleClick.bind(this)
    this.state = { message: '', images: '' }
  }

  handleClick() {
    this.fileInput.current.click()
  }

  handleKeyPress(e, sendMessage) {
    const charCode = e.which || e.keyCode
    if (e.key === 'Enter' || charCode === 13 || charCode == 10) {
      if (!e.shiftKey && !e.ctrlKey && !e.altKey) {
        this.handleSubmit(e, sendMessage)
      } else {
        pasteIntoInput(this.input.current, '\n')
        this.state.message = this.input.current.value // eslint-disable-line
        e.preventDefault()
      }
    }
  }

  handleSubmit = (e, sendMessage) => {
    const { to } = this.props
    const { images, message } = this.state
    e.preventDefault()
    if (trim(message) || images) {
      this.sendContent(sendMessage, to)
    }
  }

  async sendContent(sendMessage, to) {
    const { message, images } = this.state

    const variables = { to }

    if (message.length) {
      variables.content = message
    } else {
      variables.media = images
    }

    try {
      const { data } = await sendMessage({ variables })

      if (!data.sendMessage.success) {
        throw new Error(
          data.sendMessage.error || 'Something went wrong. Please try again.'
        )
      }

      this.setState({ message: '', images: [] })
    } catch (err) {
      console.error(err)
      this.setState({
        error: err.message
      })
    }
  }

  render() {
    const { config } = this.props
    const { images } = this.state

    return (
      <>
        {this.state.error && (
          <ToastMessage
            message={this.state.error}
            type="danger"
            onClose={() => this.setState({ error: null })}
          />
        )}
        <Mutation mutation={mutation}>
          {sendMessage => (
            <form
              className="send-message d-flex"
              onSubmit={e => this.handleSubmit(e, sendMessage)}
            >
              {images.length ? (
                <div className="images-preview">
                  {images.map(image => (
                    <div key={image.url} className="images-container">
                      <img className="img" src={image.url} />
                      <a
                        className="image-overlay-btn"
                        aria-label={fbt('Close', 'SendMessage.close')}
                        onClick={() => {
                          this.setState({
                            images: images.filter(img => img !== image)
                          })
                        }}
                      >
                        <span aria-hidden="true">&times;</span>
                      </a>
                    </div>
                  ))}
                </div>
              ) : null}
              {images.length ? null : (
                <TextareaAutosize
                  className="form-control"
                  placeholder={fbt(
                    'Type something...',
                    'SendMessage.placeholder'
                  )}
                  innerRef={this.input}
                  value={this.state.message}
                  onChange={e => this.setState({ message: e.target.value })}
                  onKeyPress={e => this.handleKeyPress(e, sendMessage)}
                />
              )}
              <img
                src="images/add-photo-icon.svg"
                className="add-photo"
                role="presentation"
                onClick={this.handleClick}
              />
              <input
                type="file"
                multiple={true}
                accept="image/jpeg,image/gif,image/png"
                ref={this.fileInput}
                className="d-none"
                onChange={async e => {
                  const newImages = await getImages(
                    config,
                    e.currentTarget.files
                  )
                  this.setState(state => ({
                    images: [...state.images, ...newImages]
                  }))
                }}
              />
              <button
                className="btn btn-sm btn-primary btn-rounded"
                type="submit"
                children={fbt('Send', 'SendMessage.send')}
              />
            </form>
          )}
        </Mutation>
      </>
    )
  }
}

export default withConfig(SendMessage)

require('react-styl')(`
  .send-message
    border-top: 1px solid var(--pale-grey)
    padding-top: 1rem
    margin-top: 1rem
    margin-bottom: 0.2rem
    .form-control
      margin-right: 1rem
      border: 0
      outline: none
    button
      margin: auto 0
      width: auto
    img.add-photo
      padding: 0 10px
    .images-preview
      flex: 1
      padding: 10px 0
      .images-container
        display: inline-block
        height: 100%
        position: relative
        max-height: 245px
        .img
          width: 185px
        .image-overlay-btn
          position: absolute
          top: 0
          right: 0
          cursor: pointer
          padding: 0.75rem
          line-height: 0.5
          background-color: white
          font-weight: bold
          border-bottom: 1px solid var(--light)
          opacity: 0.5
      .img
        background-position: center
        width: 100%
        background-size: contain
        background-repeat: no-repeat
    textarea
      max-height: 6rem
`)
