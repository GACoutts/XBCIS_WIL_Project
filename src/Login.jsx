

function Login(){
    return(
        <div className = "container">
            <img className = "logo" src = "https://placehold.co/100x30"></img>
            <div className = "header">
                <hr className = "underline">
                </hr>
                <div className = "text">
                <h2>Login</h2>
                </div>
            </div>
            <div className = "inputs">
                <div className = "input">
                    <label className = "input-head">
                        Email Address
                    </label>
                    <input type = "email" placeholder = "example@mail.com"></input>
                </div>
                <div className = "input">
                    <label className = "input-head">
                        Password
                    </label>
                    <input type = "password" placeholder = "Password123@"></input>
                </div>
            </div>
            <div className = "submit-container">
                <div className = "submit">
                Login
                </div>
                <div className = "no-account">No Account? <span> <b>Sign Up</b></span></div>
            </div>
        </div>
    );
}

export default Login