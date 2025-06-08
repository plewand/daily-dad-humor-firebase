
export class Joke {
    category: string;
    rowKey: string;
    content: string;
    author?: string;
    rating?: number;
    ratingNum?: number;
    explanation?: string;

    constructor(categoryName: string, rowKey: string, content: string, author?: string, rating?: number, ratingNum?: number, explanation?: string) {
        this.category = categoryName;
        this.rowKey = rowKey;
        this.content = content;
        this.author = author;
        this.rating = rating;
        this.ratingNum = ratingNum;
        this.explanation = explanation;
    }
}

export class TopicInfo {
    topicName!: string;
    stdJokeIndex: number;
    premiumJokeIndex: number;

    constructor(topicName: string, stdJokeIndex: number, premiumJokeIndex: number) {
        this.topicName = topicName;
        this.stdJokeIndex = stdJokeIndex;
        this.premiumJokeIndex = premiumJokeIndex;
    }
}

export class JokeWithCount {
    joke: Joke;    
    count: number;

    constructor(joke: Joke, count: number = 0) {
        this.joke = joke;
        this.count = count;
    }
}

export class JokeList {
    standardJokes: JokeWithCount[];
    premiumJokes: JokeWithCount[];
    topics : Array<TopicInfo>;


    constructor(standardJokes: JokeWithCount[], premiumJokes: JokeWithCount[], topics: Array<TopicInfo>) {
        this.standardJokes = standardJokes;
        this.premiumJokes = premiumJokes;
        this.topics = topics;
    }
}

export const jokeCategories = ['general', 'nerd', 'nature', 'culture'];