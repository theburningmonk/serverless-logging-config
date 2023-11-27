module.exports.hello = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: 'hello',
        input: event
      },
      null,
      2
    )
  }
}

module.exports.world = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: 'world',
        input: event
      },
      null,
      2
    )
  }
}
