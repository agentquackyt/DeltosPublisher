export enum PostTypes {
    REMEMBER = 'REMEMBER',
    QUOTE = 'QUOTE',
    TOPIC = 'TOPIC',
    UNSET = 'UNSET'
}

export enum FormStages {
    GENERAL = 'GENERAL',
    CONTENT = 'CONTENT',
    IMAGE = 'IMAGE'
}

interface PostDataTopic {
    title: string,
    subtitle: string,
    content: string,
    img: string
}