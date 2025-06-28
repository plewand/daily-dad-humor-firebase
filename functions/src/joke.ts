
export type Joke = {    
    jokeId: string;
    content: string;
    author?: string;
    rating?: number;
    ratingNum?: number;
    explanation?: string;
}


export const jokeCategories = ['general', 'nerd', 'nature', 'culture'];